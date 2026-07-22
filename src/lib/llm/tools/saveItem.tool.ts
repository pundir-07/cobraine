import { ToolDefinition } from "../../../types/types.tools";
import { ItemService } from "../../../services/service.item";

export const saveItemTool: ToolDefinition = {
    definition: {
        type: "function",
        function: {
            name: "save_item",
            description: "Save an item from the user to the database, automatically creating embeddings for future similarity search. Use this for notes, bookmarks, documents, etc.",
            parameters: {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        description: "The type of item to save.",
                        enum: ["note", "youtube_link", "pdf", "document", "photo", "text_message"]
                    },
                    title: {
                        type: "string",
                        description: "A short, descriptive title for the item."
                    },
                    rawContent: {
                        type: "string",
                        description: "The main text content of the item. Crucial for searching later."
                    },
                    sourceUrl: {
                        type: "string",
                        description: "If this is a bookmark or youtube_link, the URL."
                    },
                    metadata: {
                        type: "string",
                        description: "Any extra metadata as a JSON string (e.g. author, tags)."
                    }
                },
                required: ["type"]
            }
        }
    },
    async execute(args, userId, chatId) {
        // Here userId is telegramId in the execute context from service.agent.ts
        const type = String(args.type ?? "note") as any;
        const title = args.title ? String(args.title) : undefined;
        const rawContent = args.rawContent ? String(args.rawContent) : undefined;
        const sourceUrl = args.sourceUrl ? String(args.sourceUrl) : undefined;
        
        let parsedMetadata = {};
        if (args.metadata) {
            try {
                parsedMetadata = JSON.parse(String(args.metadata));
            } catch (e) {
                console.warn("Failed to parse metadata in saveItem tool");
            }
        }
        
        const result = await ItemService.saveItem({
            telegramId: userId,
            type,
            title,
            rawContent,
            sourceUrl,
            metadata: parsedMetadata
        });

        if (result.ok) {
            return `Successfully saved the item!`;
        }
        return `Failed to save item: ${result.error}`;
    },
    disabled: false
};
