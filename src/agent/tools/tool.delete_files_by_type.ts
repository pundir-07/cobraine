import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { FileService, FileType } from '../../services/service.file';

/**
 * LangGraph tool — delete all files of a specific type.
 */
export const deleteFilesByTypeTool = (telegramId: number) =>
    tool(
        async ({ type }) => {
            const result = await FileService.deleteFilesByType(telegramId, type as FileType);
            if (!result.ok) {
                return `Failed to delete files: ${result.error}`;
            }
            return `Successfully deleted ${result.count} files of type '${type}'.`;
        },
        {
            name: 'delete_files_by_type',
            description:
                'Permanently delete ALL saved files of a specific type (e.g. all photos, all documents) for the user. Use with caution.',
            schema: z.object({
                type: z
                    .enum(['photo', 'document', 'video', 'audio', 'voice'])
                    .describe('The type of files to delete in bulk.'),
            }),
        },
    );
