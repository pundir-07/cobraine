import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ItemService } from '../../services/service.item';

export const semanticSearchTool = (telegramId: number) =>
    tool(
        async ({ query, limit = 5 }) => {
            if (!query) return 'Please provide a search query.';

            try {
                const results = await ItemService.semanticSearch(telegramId, query, limit);

                if (results.length === 0) {
                    return `No results found for "${query}".`;
                }

                const formatted = results.map((r, i) => {
                    const titlePart = r.title ? `Title: ${r.title}\n` : '';
                    const typePart = `Type: ${r.type}\n`;
                    const contentPart = `Content Snippet: ${r.chunk_content}`;
                    return `--- Result ${i + 1} (Score: ${r.similarity.toFixed(2)}) ---\n${titlePart}${typePart}${contentPart}`;
                });

                return `Found ${results.length} relevant items:\n\n${formatted.join('\n\n')}`;
            } catch (error) {
                return `Failed to perform search: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
        {
            name: 'semantic_search',
            description:
                "Search the user's saved data (notes, links, documents) using semantic meaning. Use this when the user asks you to recall something, find a past note, or remember something they told you.",
            schema: z.object({
                query: z
                    .string()
                    .describe("The search query to match against the user's data."),
                limit: z
                    .number()
                    .optional()
                    .default(5)
                    .describe('The maximum number of results to return.'),
            }),
        },
    );
