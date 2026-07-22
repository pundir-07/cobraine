import { ToolDefinition } from "../../../types/types.tools";
import { ItemService } from "../../../services/service.item";

export const semanticSearchTool: ToolDefinition = {
    definition: {
        type: "function",
        function: {
            name: "semantic_search",
            description: "Search the user's saved data (notes, links, documents) using semantic meaning. Use this when the user asks you to recall something, find a past note, or remember something they told you.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The search query to match against the user's data."
                    },
                    limit: {
                        type: "number",
                        description: "The maximum number of results to return. Default is 5."
                    }
                },
                required: ["query"]
            }
        }
    },
    async execute(args, userId) {
        const query = String(args.query ?? "");
        if (!query) {
            return "Please provide a search query.";
        }
        const limit = args.limit ? Number(args.limit) : 5;
        
        try {
            const results = await ItemService.semanticSearch(userId, query, limit);
            
            if (results.length === 0) {
                return `No results found for "${query}".`;
            }
            
            const formattedResults = results.map((r, index) => {
                const titlePart = r.title ? `Title: ${r.title}\n` : "";
                const typePart = `Type: ${r.type}\n`;
                const contentPart = `Content Snippet: ${r.chunk_content}`;
                return `--- Result ${index + 1} (Score: ${r.similarity.toFixed(2)}) ---\n${titlePart}${typePart}${contentPart}`;
            });
            
            return `Found ${results.length} relevant items:\n\n${formattedResults.join("\n\n")}`;
        } catch (error) {
            console.error("Search error:", error);
            return `Failed to perform search: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
    },
    disabled: false
};
