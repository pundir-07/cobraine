import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { FileService } from '../../services/service.file';

/**
 * LangGraph tool — retrieve and send a previously saved file back to the user.
 *
 * Tries the Telegram file_id first (fast, no bandwidth), falls back to
 * streaming the locally stored file if the file_id has expired or is missing.
 */
export const sendFileTool = (chatId: number) =>
    tool(
        async ({ fileId, caption }) => {
            const result = await FileService.sendFile(fileId, chatId, caption);

            if (!result.ok) {
                return `Failed to send file: ${result.error}`;
            }

            return result.method === 'telegram_id'
                ? 'File sent successfully via Telegram cache.'
                : 'File sent successfully from local storage.';
        },
        {
            name: 'send_file',
            description:
                'Send a previously saved file back to the user in Telegram. ' +
                'Use the file UUID returned by save_file or found via search_files.',
            schema: z.object({
                fileId: z
                    .string()
                    .describe('The UUID of the saved file (from the files table).'),
                caption: z
                    .string()
                    .optional()
                    .describe('Optional caption to attach when sending the file.'),
            }),
        },
    );
