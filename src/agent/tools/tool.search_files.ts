import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { FileService } from '../../services/service.file';

/**
 * LangGraph tool — find saved files by semantic similarity to a query.
 *
 * Searches the `description_embedding` column using cosine similarity.
 * Returns a structured list of matching files so the agent can reference
 * their UUIDs in follow-up calls to send_file.
 */
export const searchFilesTool = (telegramId: number) =>
    tool(
        async ({ query, limit }) => {
            const results = await FileService.searchFiles(telegramId, query, limit ?? 5);

            if (results.length === 0) {
                return 'No saved files matched your search.';
            }

            const lines = results.map((f: any, i: number) => {
                const parts = [
                    `${i + 1}. [${f.type}] "${f.description}"`,
                    `   ID: ${f.id}`,
                ];
                if (f.original_filename) parts.push(`   Filename: ${f.original_filename}`);
                if (f.similarity !== undefined) parts.push(`   Similarity: ${(f.similarity * 100).toFixed(1)}%`);
                return parts.join('\n');
            });

            return `Found ${results.length} file(s):\n\n${lines.join('\n\n')}`;
        },
        {
            name: 'search_files',
            description:
                'Semantically search the user\'s saved files by description. ' +
                'Returns file IDs and metadata — use send_file to deliver a result to the user.',
            schema: z.object({
                query: z
                    .string()
                    .describe('Natural language description of the file you are looking for.'),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(20)
                    .optional()
                    .describe('Maximum number of results to return. Defaults to 5.'),
            }),
        },
    );
