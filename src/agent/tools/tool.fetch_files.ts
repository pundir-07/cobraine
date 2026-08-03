import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { FileService } from '../../services/service.file';

/**
 * LangGraph tool — fetch multiple files by metadata.
 */
export const fetchFilesTool = (telegramId: number) =>
    tool(
        async ({ type, descriptionKeyword, mimeType, limit, offset }) => {
            const numLimit = limit ?? 10;
            const numOffset = offset ?? 0;
            const files = await FileService.fetchFiles(
                telegramId,
                { type, description: descriptionKeyword, mimeType },
                numLimit,
                numOffset
            );

            if (files.length === 0) {
                return `No files found matching the criteria (offset: ${numOffset}).`;
            }

            const formatString = files
                .map((f, i) => {
                    const idx = numOffset + i + 1;
                    return `${idx}. [ID: ${f.id}] [Type: ${f.type}] [Mime: ${f.mime_type}] Desc: "${f.description}"`;
                })
                .join('\n');

            return `Found ${files.length} file(s) (offset: ${numOffset}, limit: ${numLimit}):\n${formatString}\nIf you need more, you can query again with an offset of ${numOffset + files.length}.`;
        },
        {
            name: 'fetch_files',
            description:
                'Fetch multiple files filtered by exact type, exact MIME type, or substring description matching. Use offset to paginate results if there are more than the limit.',
            schema: z.object({
                type: z
                    .enum(['photo', 'document', 'video', 'audio', 'voice'])
                    .optional()
                    .describe('Filter by the type of file attachment.'),
                descriptionKeyword: z
                    .string()
                    .optional()
                    .describe('Filter by a substring match in the description. Example: "receipt".'),
                mimeType: z
                    .string()
                    .optional()
                    .describe('Filter by an exact MIME type. Example: "application/pdf".'),
                limit: z
                    .number()
                    .max(20)
                    .optional()
                    .describe('The maximum number of files to return. Defaults to 10.'),
                offset: z
                    .number()
                    .optional()
                    .describe('The number of files to skip for pagination. Defaults to 0.'),
            }),
        },
    );
