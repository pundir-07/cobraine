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
