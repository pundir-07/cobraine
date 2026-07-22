// A catch-all tool for when the LLM just wants to respond with text.

import { ToolDefinition } from "../../../types/types.tools";

// The LLM must ALWAYS use this if no other tool is appropriate.
export const textResponseTool: ToolDefinition = {
    definition: {
        type: "function",
        function: {
            name: "text_response",
            description: "Send a normal text reply to the user. Use this when no other tool fits.",
            parameters: {
                type: "object",
                properties: {
                    content: {
                        type: "string",
                        description: "Your response to the user, formatted with Telegram HTML."
                    }
                },
                required: ["content"]
            }
        }
    },
    async execute(args) {
        return String(args.content ?? "");
    },
    disabled: true
};