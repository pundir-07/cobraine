import { ChatCompletionTool } from "openai/resources/chat/completions";

export interface ToolDefinition {
    definition: ChatCompletionTool;
    execute(
        args: Record<string, unknown>,
        userId: number,
        chatId: number,
    ): Promise<string>;
    disabled: boolean;
    requiresFeedback?: boolean;
}
