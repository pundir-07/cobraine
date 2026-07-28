import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ItemService } from '../../services/service.item';

export const saveItemTool = (telegramId: number) =>
    tool(
        async ({ type, title, rawContent, sourceUrl, metadata }) => {
            let parsedMetadata: Record<string, unknown> = {};
            if (metadata) {
                try {
                    parsedMetadata = JSON.parse(metadata);
                } catch {
                    console.warn('save_item: failed to parse metadata JSON');
                }
            }

            const result = await ItemService.saveItem({
                telegramId,
                type: type as any,
                title,
                rawContent,
                sourceUrl,
                metadata: parsedMetadata,
            });

            return result.ok
                ? 'Successfully saved the item!'
                : `Failed to save item: ${result.error}`;
        },
        {
            name: 'save_item',
            description:
                "Save an item from the user to the database, automatically creating embeddings for future similarity search. Use this for notes, bookmarks, documents, etc.",
            schema: z.object({
                type: z
                    .enum(['note', 'youtube_link', 'pdf', 'document', 'photo', 'text_message'])
                    .describe('The type of item to save.'),
                title: z
                    .string()
                    .optional()
                    .describe('A short, descriptive title for the item.'),
                rawContent: z
                    .string()
                    .optional()
                    .describe('The main text content of the item. Crucial for searching later.'),
                sourceUrl: z
                    .string()
                    .optional()
                    .describe('If this is a bookmark or youtube_link, the URL.'),
                metadata: z
                    .string()
                    .optional()
                    .describe('Any extra metadata as a JSON string (e.g. author, tags).'),
            }),
        },
    );
