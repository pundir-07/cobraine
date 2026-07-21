import { buildSystemPrompt } from "../features/agent/prompt";
import { ChatMessage } from "../types/types.message";
import { MessageService } from "./service.message";
import { config } from "../config";
import { getToolByName } from "../features/agent/tools";

interface ChatCompletionResponse {
    id: string;
    choices: {
        index: number;
        message: ChatMessage;
        finish_reason: string;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

interface ChatOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

export class AgentService {
    private baseUrl: string;
    private apiKey: string;
    private defaultModel: string;

    constructor() {
        this.baseUrl = config.openrouter.baseUrl;
        this.apiKey = config.openrouter.apiKey;
        this.defaultModel = config.openrouter.defaultModel;
    }

    async chat(
        messages: ChatMessage[],
        options?: ChatOptions,
    ): Promise<string> {
        const response = await fetch(
            `${this.baseUrl}${config.openrouter.freeEndpoint}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: options?.model ?? this.defaultModel,
                    messages,
                    temperature: options?.temperature ?? 0.7,
                    max_tokens: options?.maxTokens ?? 1024,
                }),
            },
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `OpenRouter API error (${response.status}): ${errorText}`,
            );
        }

        const data: ChatCompletionResponse = await response.json();
        return data.choices[0]?.message?.content ?? "";
    }

    async continueUserChat(
        userUuid: string,
        telegramId: number,
        chatId: number,
        currentPrompt: string,
    ): Promise<string> {
        const messages = await this.buildChatContext(
            userUuid,
            telegramId,
            currentPrompt,
        );
        const rawResponse = await this.chat(messages);

        const trimmed = rawResponse.trim();
        let finalContent: string;

        // The LLM must ALWAYS respond with <tool_call> XML.
        // If it doesn't, wrap the response in a text_response tool call.
        const xmlStart = trimmed.indexOf("<tool_call>");
        const xmlEnd = trimmed.lastIndexOf("</tool_call>");

        if (xmlStart !== -1 && xmlEnd !== -1) {
            const xmlBlock = trimmed.slice(
                xmlStart,
                xmlEnd + "</tool_call>".length,
            );
            const parsed = this.parseToolCallXml(xmlBlock);

            if (!parsed) {
                // Malformed XML — treat as text_response
                finalContent = trimmed;
            } else {
                const tool = getToolByName(parsed.tool);

                if (!tool) {
                    finalContent = trimmed;
                } else {
                    const result = await tool.execute(
                        parsed.arguments,
                        telegramId,
                        chatId,
                    );
                    finalContent = result;
                }
            }
        } else {
            // No XML found — wrap everything as a text_response
            const textTool = getToolByName("text_response");
            if (textTool) {
                finalContent = await textTool.execute(
                    { content: trimmed },
                    telegramId,
                    chatId,
                );
            } else {
                finalContent = trimmed;
            }
        }
        return finalContent;
    }

    private async buildChatContext(
        userUuid: string,
        telegramChatId: number,
        currentPrompt: string,
    ): Promise<ChatMessage[]> {
        const history = await MessageService.getConversationHistory(
            userUuid,
            telegramChatId,
        );

        const messages: ChatMessage[] = [
            { role: "system", content: buildSystemPrompt() },
        ];

        for (const msg of history) {
            messages.push({ role: msg.role, content: msg.content });
        }

        messages.push({ role: "user", content: currentPrompt });

        return messages;
    }
    private parseToolCallXml(
        xml: string,
    ): { tool: string; arguments: Record<string, unknown> } | null {
        const toolMatch = xml.match(/<tool_name>([\s\S]*?)<\/tool_name>/);
        if (!toolMatch) return null;

        const tool = toolMatch[1].trim();
        const args: Record<string, unknown> = {};

        const argsMatch = xml.match(/<arguments>([\s\S]*?)<\/arguments>/);
        if (argsMatch) {
            const argsXml = argsMatch[1];
            const paramRegex = /<([a-zA-Z_][a-zA-Z0-9_]*)>([\s\S]*?)<\/\1>/g;
            let paramMatch: RegExpExecArray | null;
            while ((paramMatch = paramRegex.exec(argsXml)) !== null) {
                args[paramMatch[1]] = paramMatch[2].trim();
            }
        }

        return { tool, arguments: args };
    }
}
export const OpenRouterAgentService = new AgentService();
