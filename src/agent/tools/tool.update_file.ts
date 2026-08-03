import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { FileService } from '../../services/service.file';

/**
 * LangGraph tool — update a file's description.
 */
export const updateFileTool = (telegramId: number) =>
    tool(
        async ({ fileId, newDescription }) => {
            const result = await FileService.updateFile(fileId, telegramId, newDescription);
            if (!result.ok) {
                return `Failed to update file: ${result.error}`;
            }
            return `File description successfully updated for file ID: ${fileId}.`;
        },
        {
            name: 'update_file',
            description:
                'Update the description of a previously saved file. This will also update its embedding for semantic search. You MUST provide the UUID of the file.',
            schema: z.object({
                fileId: z
                    .string()
                    .describe('The UUID of the file to update.'),
                newDescription: z
                    .string()
                    .describe('The new description for the file.'),
            }),
        },
    );
