import { pool } from "../lib/postgres";
import { ollamaEmbedding } from "../lib/embeddings/ollama";

export interface SaveItemInput {
    telegramId: number;
    type: 'note' | 'reminder' | 'youtube_link' | 'pdf' | 'document' | 'photo' | 'text_message';
    title?: string;
    rawContent?: string;
    sourceUrl?: string;
    telegramFileId?: string;
    mimeType?: string;
    metadata?: Record<string, any>;
}

export class ItemService {
    /**
     * Splits text into smaller chunks for embeddings.
     * Uses a simple paragraph or max length-based chunking.
     */
    private static chunkText(text: string, maxTokensOrLength = 1000): string[] {
        if (!text) return [];
        // A simple heuristic: split by double newlines (paragraphs)
        const paragraphs = text.split(/\n\s*\n/);
        const chunks: string[] = [];
        let currentChunk = "";

        for (const paragraph of paragraphs) {
            if ((currentChunk.length + paragraph.length) > maxTokensOrLength && currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = "";
            }
            currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
        }
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        // If a single paragraph is longer than the max, split it by characters as fallback
        const finalChunks: string[] = [];
        for (const chunk of chunks) {
            if (chunk.length > maxTokensOrLength * 1.5) {
                for (let i = 0; i < chunk.length; i += maxTokensOrLength) {
                    finalChunks.push(chunk.substring(i, i + maxTokensOrLength));
                }
            } else {
                finalChunks.push(chunk);
            }
        }

        return finalChunks;
    }

    static async saveItem(input: SaveItemInput): Promise<{ ok: boolean, itemId?: string, error?: string }> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Ensure user exists
            const userRes = await client.query(`
                INSERT INTO users (telegram_id)
                VALUES ($1)
                ON CONFLICT (telegram_id) DO UPDATE SET updated_at = now()
                RETURNING id
            `, [input.telegramId]);
            const userUuid = userRes.rows[0].id;

            // 2. Insert the item
            const metadata = input.metadata ? JSON.stringify(input.metadata) : '{}';
            
            const itemRes = await client.query(`
                INSERT INTO items (user_id, type, title, raw_content, source_url, telegram_file_id, mime_type, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `, [
                userUuid, 
                input.type, 
                input.title || null, 
                input.rawContent || null, 
                input.sourceUrl || null, 
                input.telegramFileId || null, 
                input.mimeType || null, 
                metadata
            ]);
            
            const itemId = itemRes.rows[0].id;

            // 3. Process embeddings if we have content
            if (input.rawContent) {
                const chunks = ItemService.chunkText(input.rawContent);
                
                if (chunks.length > 0) {
                    const embeddings = await ollamaEmbedding.embedBatch(chunks);

                    for (let i = 0; i < chunks.length; i++) {
                        const chunkContent = chunks[i];
                        const embedding = embeddings[i];
                        
                        // Insert chunk
                        const chunkRes = await client.query(`
                            INSERT INTO chunks (item_id, chunk_index, content)
                            VALUES ($1, $2, $3)
                            RETURNING id
                        `, [itemId, i, chunkContent]);
                        
                        const chunkId = chunkRes.rows[0].id;
                        
                        // Insert embedding using pgvector. Ensure embedding vector format: '[1,2,3]'
                        const vectorStr = `[${embedding.join(',')}]`;
                        await client.query(`
                            INSERT INTO embeddings (chunk_id, embedding)
                            VALUES ($1, $2)
                        `, [chunkId, vectorStr]);
                    }
                }
            }

            await client.query('COMMIT');
            return { ok: true, itemId };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error saving item:', error);
            return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
        } finally {
            client.release();
        }
    }
}
