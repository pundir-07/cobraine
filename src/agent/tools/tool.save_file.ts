import path from 'path';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { TelegramFileService } from '../../services/service.telegram_file';
import { FileService, FileType } from '../../services/service.file';
import { PDFParse } from "pdf-parse";

async function extractPdfText(buffer: Buffer): Promise<string> {
    let parser: PDFParse | undefined;

    try {
        parser = new PDFParse({
            data: buffer,
            verbosity: 0,
        });

        const result = await parser.getText();

        return result.text?.trim() ?? "";
    } catch (err) {
        console.warn(
            "save_file: pdf-parse failed, skipping text extraction:",
            err,
        );

        return "";
    } finally {
        if (parser) {
            await parser.destroy();
        }
    }
}

/**
 * LangGraph tool — save a file attachment sent by the user.
 *
 * The agent should:
 *  1. Notice an [Attachment: ...] block in the message
 *  2. Ask the user for a description of the file if one wasn't provided
 *  3. Call this tool with the fileId from the attachment block and the description
 *
 * Files are stored at: ./storage/files/<telegramId>/<fileUuid>.<ext>
 */
export const saveFileTool = (telegramId: number) =>
    tool(
        async ({ telegramFileId, type, description, filename, mimeType }) => {
            // ── 1. Determine local storage path (pre-generate UUID-like name) ──
            //    We derive the extension from either the filename or MIME type.
            const ext = filename
                ? path.extname(filename).replace('.', '') || 'bin'
                : (mimeType?.split('/')[1] ?? 'bin');

            // Temporary path — will be replaced with DB-assigned uuid after insert
            const tempId = Date.now().toString(36);
            const destPath = path.resolve(
                process.cwd(),
                'storage',
                'files',
                String(telegramId),
                `${tempId}.${ext}`,
            );

            // ── 2. Download from Telegram and save to disk ────────────────────
            let saved;
            try {
                saved = await TelegramFileService.downloadAndSave(telegramFileId, destPath, mimeType);
            } catch (err) {
                return `Failed to download file from Telegram: ${err instanceof Error ? err.message : err}`;
            }

            // ── 3. Extract text for documents / PDFs ──────────────────────────
            let extractedText: string | undefined;
            if (type === 'document' && saved.buffer.length > 0) {
                const isPdf =
                    saved.mimeType === 'application/pdf' ||
                    ext === 'pdf';
                if (isPdf) {
                    extractedText = await extractPdfText(saved.buffer);
                }
            }

            // ── 4. Persist to DB ───────────────────────────────────────────────
            const result = await FileService.saveFile({
                telegramId,
                type: type as FileType,
                description,
                telegramFileId,
                localPath: saved.localPath,
                originalFilename: filename,
                mimeType: saved.mimeType,
                fileSizeBytes: saved.buffer.length,
                extractedText,
            });

            if (!result.ok) {
                return `Failed to save file: ${result.error}`;
            }

            // ── 5. Rename local file to final UUID-based name ──────────────────
            //    Best-effort rename so the path stored in DB matches disk reality
            const finalPath = path.resolve(
                process.cwd(),
                'storage',
                'files',
                String(telegramId),
                `${result.fileId}.${ext}`,
            );
            try {
                const fs = await import('fs/promises');
                await fs.rename(saved.localPath, finalPath);

                // Update the DB record with the final path
                const { pool } = await import('../../lib/postgres.js');
                await pool.query(
                    `UPDATE files SET local_path = $1 WHERE id = $2`,
                    [finalPath, result.fileId],
                );
            } catch {
                // Non-fatal — the file is still accessible at the temp path
            }

            return `File saved successfully! File ID: ${result.fileId}${extractedText ? ' (text extracted for search)' : ''}`;
        },
        {
            name: 'save_file',
            description:
                'Save a file attachment (photo, document, video, audio, voice note) sent by the user. ' +
                'Always ask the user for a description before calling this tool — the description is used for future search. ' +
                'Pass the fileId exactly as it appears in the [Attachment: ... fileId="..."] block.',
            schema: z.object({
                telegramFileId: z
                    .string()
                    .describe('The Telegram file_id from the [Attachment] block in the message.'),
                type: z
                    .enum(['photo', 'document', 'video', 'audio', 'voice'])
                    .describe('The type of the file attachment.'),
                description: z
                    .string()
                    .describe(
                        'A clear description of what this file is about. Required — used for semantic search later.',
                    ),
                filename: z
                    .string()
                    .optional()
                    .describe('Original filename if available from the attachment block.'),
                mimeType: z
                    .string()
                    .optional()
                    .describe('MIME type if available from the attachment block.'),
            }),
        },
    );
