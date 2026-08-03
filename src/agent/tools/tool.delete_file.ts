import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { FileService } from '../../services/service.file';

/**
 * LangGraph tool — delete a file.
 */
export const deleteFileTool = (telegramId: number) =>
    tool(
        async ({ fileId }) => {
            const result = await FileService.deleteFile(fileId, telegramId);
            if (!result.ok) {
                return `Failed to delete file: ${result.error}`;
            }
            return `File successfully deleted.`;
        },
        {
            name: 'delete_file',
            description:
                'Permanently delete a previously saved file from the database and local storage. You MUST provide the UUID of the file.',
            schema: z.object({
                fileId: z
                    .string()
                    .describe('The UUID of the file to delete.'),
            }),
        },
    );
