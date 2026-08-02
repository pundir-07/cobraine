import fs from 'fs/promises';
import path from 'path';
import { bot } from '../lib/telegram';
import { Attachment } from '../agent/types/types.agent.attachment';

/**
 * Resolved file reference — contains everything needed to consume the file
 * (raw bytes, base64, public URL, and inferred MIME type).
 */
export interface ResolvedFile {
    /** Raw file bytes. */
    buffer: Buffer;
    /** Base64-encoded content (convenient for LLM multimodal APIs). */
    base64: string;
    /** Public HTTPS URL valid for ~1 hour (Telegram CDN). */
    url: string;
    /** MIME type — from the attachment metadata or inferred from the file path extension. */
    mimeType: string;
    /** Original file_path returned by Telegram (e.g. "photos/file_0.jpg"). */
    filePath: string;
}

export interface SavedFile extends ResolvedFile {
    /** Absolute path where the file was written on the local filesystem. */
    localPath: string;
}

/**
 * Handles all Telegram file operations keyed by `telegramFileId`.
 *
 * Telegram bots never receive file content directly — they receive a file_id
 * reference. This service resolves those references into usable content via
 * two sequential Telegram API calls:
 *   1. getFile(fileId)  →  obtains the server-side file_path
 *   2. fetch(cdnUrl)    →  downloads the actual bytes
 *
 * Static methods are used to match the existing service conventions in this
 * project (MessageService, UserService, etc.).
 */
export class TelegramFileService {
    /**
     * Resolve and download a file by its Telegram file_id.
     * Works for any attachment type (photo, document, video, audio, voice).
     *
     * @param fileId   - The `telegramFileId` from an `Attachment` object.
     * @param mimeHint - Optional MIME type hint from attachment metadata.
     *                   Falls back to extension-based inference.
     */
    static async download(fileId: string, mimeHint?: string): Promise<ResolvedFile> {
        const file = await bot.api.getFile(fileId);

        if (!file.file_path) {
            throw new Error(`TelegramFileService: Telegram returned no file_path for fileId=${fileId}`);
        }

        const token = process.env.BOT_TOKEN;
        if (!token) {
            throw new Error('TelegramFileService: BOT_TOKEN is not set');
        }

        const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        const res = await fetch(url);

        if (!res.ok) {
            throw new Error(
                `TelegramFileService: failed to fetch file — HTTP ${res.status} ${res.statusText}`,
            );
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        const base64 = buffer.toString('base64');
        const mimeType = mimeHint ?? TelegramFileService.inferMime(file.file_path);

        return { buffer, base64, url, mimeType, filePath: file.file_path };
    }

    /**
     * Convenience wrapper — download directly from an `Attachment` object.
     * The MIME type is taken from the attachment metadata when available.
     */
    static async fromAttachment(attachment: Attachment): Promise<ResolvedFile> {
        return TelegramFileService.download(attachment.telegramFileId, attachment.mimeType);
    }

    /**
     * Download a file and persist it to the local filesystem.
     * Creates parent directories automatically.
     *
     * @param fileId   - Telegram file_id reference.
     * @param destPath - Absolute path where the file should be written.
     * @param mimeHint - Optional MIME type hint.
     */
    static async downloadAndSave(fileId: string, destPath: string, mimeHint?: string): Promise<SavedFile> {
        const resolved = await TelegramFileService.download(fileId, mimeHint);
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(destPath, resolved.buffer);
        return { ...resolved, localPath: destPath };
    }

    /**
     * Resolve only the public CDN URL for a file_id without downloading bytes.
     * Useful when you just need to pass a URL to an external service.
     *
     * Note: Telegram CDN URLs are valid for approximately 1 hour.
     */
    static async getUrl(fileId: string): Promise<string> {
        const file = await bot.api.getFile(fileId);

        if (!file.file_path) {
            throw new Error(`TelegramFileService: Telegram returned no file_path for fileId=${fileId}`);
        }

        const token = process.env.BOT_TOKEN;
        if (!token) {
            throw new Error('TelegramFileService: BOT_TOKEN is not set');
        }

        return `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    }

    /**
     * Download a file and return only the base64 string.
     * Primarily for feeding images/audio directly to multimodal LLM APIs.
     */
    static async toBase64(fileId: string, mimeHint?: string): Promise<string> {
        const { base64 } = await TelegramFileService.download(fileId, mimeHint);
        return base64;
    }

    // ─── Private helpers ────────────────────────────────────────────────────────

    /**
     * Infer a MIME type from the file extension in a Telegram file_path.
     * Telegram does not always provide MIME types (e.g. for photos).
     */
    private static inferMime(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            mp4: 'video/mp4',
            mov: 'video/quicktime',
            avi: 'video/x-msvideo',
            mp3: 'audio/mpeg',
            ogg: 'audio/ogg',
            oga: 'audio/ogg',
            wav: 'audio/wav',
            pdf: 'application/pdf',
            doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            txt: 'text/plain',
            json: 'application/json',
            zip: 'application/zip',
        };
        return mimeMap[ext ?? ''] ?? 'application/octet-stream';
    }
}
