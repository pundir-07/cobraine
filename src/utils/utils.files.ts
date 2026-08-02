/**
 * @deprecated Use TelegramFileService from '../../services/service.telegram_file' instead.
 * This shim exists only for backwards compatibility.
 */
import { TelegramFileService } from '../services/service.telegram_file';

export async function downloadTelegramFile(fileId: string): Promise<Buffer> {
    const { buffer } = await TelegramFileService.download(fileId);
    return buffer;
}