import path from 'path';
import fs from 'fs';
import { pool } from '../lib/postgres';
import { voyageEmbedding } from '../lib/embeddings/voyage';
import { bot } from '../lib/telegram';
import { InputFile } from 'grammy';

export type FileType = 'photo' | 'document' | 'video' | 'audio' | 'voice';

export interface SaveFileInput {
    telegramId: number;
    type: FileType;
    description: string;
    telegramFileId?: string;
    localPath?: string;
    originalFilename?: string;
    mimeType?: string;
    fileSizeBytes?: number;
    extractedText?: string;
}

export interface FileRow {
    id: string;
    type: FileType;
    description: string;
    telegram_file_id: string | null;
    local_path: string | null;
    original_filename: string | null;
    mime_type: string | null;
    file_size_bytes: number | null;
    extracted_text: string | null;
    status: string;
    created_at: Date;
}

/**
 * Domain service for the `files` table.
 *
 * Responsibilities:
 *  - Persist file metadata + description embedding
 *  - Semantic search across file descriptions
 *  - Send a saved file back to a Telegram chat (grammy-first, local fallback)
 *
 * Follows the same static-class convention as MessageService, UserService, etc.
 */
export class FileService {
    /**
     * Persist a file record, embed its description, and store the row.
     * Returns the newly created file UUID on success.
     */
    static async saveFile(input: SaveFileInput): Promise<{ ok: boolean; fileId?: string; error?: string }> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Resolve user UUID from telegram_id
            const userRes = await client.query(
                `SELECT id FROM users WHERE telegram_id = $1`,
                [input.telegramId],
            );
            if (userRes.rows.length === 0) {
                throw new Error(`FileService: no user found for telegramId=${input.telegramId}`);
            }
            const userUuid: string = userRes.rows[0].id;

            // Embed the description for semantic search
            const embeddingVector = await voyageEmbedding.embed(input.description);
            const vectorStr = `[${embeddingVector.join(',')}]`;

            const fileRes = await client.query(
                `INSERT INTO files
                    (user_id, type, description, description_embedding,
                     telegram_file_id, local_path, original_filename,
                     mime_type, file_size_bytes, extracted_text)
                 VALUES ($1, $2, $3, $4::vector, $5, $6, $7, $8, $9, $10)
                 RETURNING id`,
                [
                    userUuid,
                    input.type,
                    input.description,
                    vectorStr,
                    input.telegramFileId ?? null,
                    input.localPath ?? null,
                    input.originalFilename ?? null,
                    input.mimeType ?? null,
                    input.fileSizeBytes ?? null,
                    input.extractedText ?? null,
                ],
            );

            const fileId: string = fileRes.rows[0].id;
            await client.query('COMMIT');
            return { ok: true, fileId };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('FileService.saveFile error:', error);
            return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
        } finally {
            client.release();
        }
    }

    /**
     * Semantic search over file descriptions using cosine similarity.
     * Returns the top `limit` matches for the given query.
     */
    static async searchFiles(
        telegramId: number,
        query: string,
        limit = 5,
    ): Promise<FileRow[]> {
        const client = await pool.connect();
        try {
            const userRes = await client.query(
                `SELECT id FROM users WHERE telegram_id = $1`,
                [telegramId],
            );
            if (userRes.rows.length === 0) return [];
            const userUuid: string = userRes.rows[0].id;

            const queryEmbedding = await voyageEmbedding.embed(query);
            const vectorStr = `[${queryEmbedding.join(',')}]`;

            const searchRes = await client.query(
                `SELECT
                    id, type, description, telegram_file_id, local_path,
                    original_filename, mime_type, file_size_bytes, extracted_text,
                    status, created_at,
                    1 - (description_embedding <=> $1::vector) AS similarity
                 FROM files
                 WHERE user_id = $2 AND status = 'active'
                   AND description_embedding IS NOT NULL
                 ORDER BY description_embedding <=> $1::vector
                 LIMIT $3`,
                [vectorStr, userUuid, limit],
            );

            return searchRes.rows;
        } catch (error) {
            console.error('FileService.searchFiles error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Send a saved file to a Telegram chat.
     *
     * Retrieval strategy:
     *   1. Try grammy with the stored `telegram_file_id` — fast, zero bandwidth cost.
     *      Telegram may return 400 if the file_id has expired.
     *   2. Fall back to streaming the local file from disk via grammy `InputFile`.
     *
     * @param fileUuid - UUID of the `files` row.
     * @param chatId   - Telegram chat to send the file to.
     * @param caption  - Optional caption.
     */
    static async sendFile(
        fileUuid: string,
        chatId: number,
        caption?: string,
    ): Promise<{ ok: boolean; method: 'telegram_id' | 'local_file'; error?: string }> {
        const client = await pool.connect();
        let row: FileRow | null = null;

        try {
            const res = await client.query(
                `SELECT id, type, telegram_file_id, local_path, mime_type FROM files WHERE id = $1`,
                [fileUuid],
            );
            if (res.rows.length === 0) {
                return { ok: false, method: 'telegram_id', error: `No file found with id=${fileUuid}` };
            }
            row = res.rows[0] as FileRow;
        } finally {
            client.release();
        }

        const sendOptions = caption ? { caption } : {};
        const sendFn = FileService.resolveGrammySendFn(row.type);

        // ── Strategy 1: grammy file_id (no download, instant) ─────────────────
        if (row.telegram_file_id) {
            try {
                await sendFn(chatId, row.telegram_file_id, sendOptions);
                return { ok: true, method: 'telegram_id' };
            } catch (err) {
                // Telegram returns 400 for expired/invalid file_ids — fall through to local
                console.warn(`FileService.sendFile: grammy fileId failed, falling back to local. Error: ${err}`);
            }
        }

        // ── Strategy 2: local file stream ──────────────────────────────────────
        if (row.local_path && fs.existsSync(row.local_path)) {
            try {
                const ext = path.extname(row.local_path).slice(1);
                const inputFile = new InputFile(fs.createReadStream(row.local_path), `file.${ext}`);
                await sendFn(chatId, inputFile, sendOptions);
                return { ok: true, method: 'local_file' };
            } catch (err) {
                return { ok: false, method: 'local_file', error: String(err) };
            }
        }

        return {
            ok: false,
            method: 'telegram_id',
            error: 'Neither a valid telegram_file_id nor a local_path is available for this file.',
        };
    }

    /**
     * Fetch multiple files by type, description, or mime_type.
     * Supports pagination via offset and limit (default 10).
     */
    static async fetchFiles(
        telegramId: number,
        filters: { type?: string; description?: string; mimeType?: string },
        limit = 10,
        offset = 0
    ): Promise<FileRow[]> {
        const client = await pool.connect();
        try {
            const userRes = await client.query(
                `SELECT id FROM users WHERE telegram_id = $1`,
                [telegramId],
            );
            if (userRes.rows.length === 0) return [];
            const userUuid: string = userRes.rows[0].id;

            let queryStr = `SELECT * FROM files WHERE user_id = $1 AND status = 'active'`;
            const params: any[] = [userUuid];
            let paramIndex = 2;

            if (filters.type) {
                queryStr += ` AND type = $${paramIndex++}`;
                params.push(filters.type);
            }
            if (filters.mimeType) {
                queryStr += ` AND mime_type = $${paramIndex++}`;
                params.push(filters.mimeType);
            }
            if (filters.description) {
                queryStr += ` AND description ILIKE $${paramIndex++}`;
                params.push(`%${filters.description}%`);
            }

            queryStr += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            params.push(limit, offset);

            const searchRes = await client.query(queryStr, params);
            return searchRes.rows;
        } catch (error) {
            console.error('FileService.fetchFiles error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Update a file's description (and re-embed it).
     */
    static async updateFile(
        fileUuid: string,
        telegramId: number,
        newDescription: string
    ): Promise<{ ok: boolean; error?: string }> {
        const client = await pool.connect();
        try {
            const userRes = await client.query(
                `SELECT id FROM users WHERE telegram_id = $1`,
                [telegramId],
            );
            if (userRes.rows.length === 0) return { ok: false, error: 'User not found' };
            const userUuid: string = userRes.rows[0].id;

            const embeddingVector = await voyageEmbedding.embed(newDescription);
            const vectorStr = `[${embeddingVector.join(',')}]`;

            const updateRes = await client.query(
                `UPDATE files 
                 SET description = $1, description_embedding = $2::vector, updated_at = now() 
                 WHERE id = $3 AND user_id = $4`,
                [newDescription, vectorStr, fileUuid, userUuid]
            );

            if (updateRes.rowCount === 0) {
                return { ok: false, error: 'File not found or access denied' };
            }
            return { ok: true };
        } catch (error) {
            console.error('FileService.updateFile error:', error);
            return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
        } finally {
            client.release();
        }
    }

    /**
     * Hard delete a file from the database and the local storage.
     */
    static async deleteFile(
        fileUuid: string,
        telegramId: number
    ): Promise<{ ok: boolean; error?: string }> {
        const client = await pool.connect();
        try {
            const userRes = await client.query(
                `SELECT id FROM users WHERE telegram_id = $1`,
                [telegramId],
            );
            if (userRes.rows.length === 0) return { ok: false, error: 'User not found' };
            const userUuid: string = userRes.rows[0].id;

            const res = await client.query(
                `DELETE FROM files WHERE id = $1 AND user_id = $2 RETURNING local_path`,
                [fileUuid, userUuid]
            );

            if (res.rowCount === 0) {
                return { ok: false, error: 'File not found or access denied' };
            }

            const localPath = res.rows[0].local_path;
            if (localPath && fs.existsSync(localPath)) {
                await fs.promises.unlink(localPath).catch(err => {
                    console.warn(`FileService.deleteFile: failed to unlink local file ${localPath}:`, err);
                });
            }

            return { ok: true };
        } catch (error) {
            console.error('FileService.deleteFile error:', error);
            return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
        } finally {
            client.release();
        }
    }

    /**
     * Delete all files of a specific type for a user.
     */
    static async deleteFilesByType(
        telegramId: number,
        type: FileType
    ): Promise<{ ok: boolean; count?: number; error?: string }> {
        const client = await pool.connect();
        try {
            const userRes = await client.query(
                `SELECT id FROM users WHERE telegram_id = $1`,
                [telegramId],
            );
            if (userRes.rows.length === 0) return { ok: false, error: 'User not found' };
            const userUuid: string = userRes.rows[0].id;

            // Fetch local paths before deleting
            const pathsRes = await client.query(
                `SELECT local_path FROM files WHERE user_id = $1 AND type = $2 AND local_path IS NOT NULL`,
                [userUuid, type]
            );

            const res = await client.query(
                `DELETE FROM files WHERE user_id = $1 AND type = $2`,
                [userUuid, type]
            );

            // Delete local files
            for (const row of pathsRes.rows) {
                if (row.local_path && fs.existsSync(row.local_path)) {
                    await fs.promises.unlink(row.local_path).catch(err => {
                        console.warn(`FileService.deleteFilesByType: failed to unlink ${row.local_path}:`, err);
                    });
                }
            }

            return { ok: true, count: res.rowCount ?? 0 };
        } catch (error) {
            console.error('FileService.deleteFilesByType error:', error);
            return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
        } finally {
            client.release();
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * Map a file type to the appropriate grammy Bot API send method.
     * All methods share the signature: (chatId, file, options?) => Promise<Message>.
     */
    private static resolveGrammySendFn(type: FileType) {
        switch (type) {
            case 'photo':   return bot.api.sendPhoto.bind(bot.api);
            case 'video':   return bot.api.sendVideo.bind(bot.api);
            case 'audio':   return bot.api.sendAudio.bind(bot.api);
            case 'voice':   return bot.api.sendVoice.bind(bot.api);
            case 'document':
            default:        return bot.api.sendDocument.bind(bot.api);
        }
    }
}
