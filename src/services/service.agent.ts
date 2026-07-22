import { buildSystemPrompt } from "../lib/llm/prompt";
import { ChatMessage } from "../types/types.message";
import { MessageService } from "./service.message";
import { config } from "../config";
import { toolsManager } from "../lib/llm/tools";
import { writeFileSync } from "node:fs";

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
    tools?: any[];
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
    ): Promise<ChatMessage> {
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
                    tools: options?.tools,
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
        console.log("Response data : ", data.choices[0].message)
        return data.choices[0]?.message as ChatMessage;
    }

    async continueUserChat(
        userUuid: string,
        telegramId: number,
        chatId: number,
        currentPrompt: string,
        additional_metadata?: string
    ): Promise<string> {
        const initialMessages = await this.buildChatContext(
            userUuid,
            telegramId,
            currentPrompt,
            additional_metadata
        );

        let currentMessages = [...initialMessages];

        while (true) {
            const agentMsg = await this.chat(currentMessages, { tools: toolsManager.getNativeTools() });
            const agentMessage = agentMsg as any;

            // @ts-ignore - OpenAI types handle tool_calls but sometimes OpenRouter returns them slightly differently
            const toolCalls = agentMessage.tool_calls || agentMessage.function_call ? [{ function: agentMessage.function_call }] : null;

            if (agentMessage.tool_calls && agentMessage.tool_calls.length > 0) {
                console.dir(agentMessage, { depth: null })
                currentMessages.push(agentMessage);

                for (const toolCall of agentMessage.tool_calls) {
                    const toolName = toolCall.function.name;
                    const tool = toolsManager.getToolByName(toolName);
                    console.log("Found tool:", tool)
                    let resultContent: string;
                    if (!tool) {
                        resultContent = `Error: Unknown tool '${toolName}'`;
                    } else {
                        try {
                            const args = JSON.parse(toolCall.function.arguments || '{}');
                            console.log("ATTEMPTING TOOL CALL: ", tool)
                            resultContent = await tool.execute(args, telegramId, chatId);
                        } catch (e) {
                            resultContent = `Error executing tool: ${e instanceof Error ? e.message : String(e)}`;
                        }
                    }

                    currentMessages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: resultContent
                    });
                }
            } else {
                return agentMessage.content ? String(agentMessage.content) : "";
            }
        }
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    private async buildChatContext(
        userUuid: string,
        telegramChatId: number,
        currentPrompt: string,
        additional_metadata?: string
    ): Promise<ChatMessage[]> {
        const history = await MessageService.getConversationHistory(
            userUuid,
            telegramChatId,
        );
        const systemPrompt = buildSystemPrompt()
        writeFileSync("./systemPrompt.txt", systemPrompt)
        const messages: ChatMessage[] = [
            { role: "system", content: `${systemPrompt}\n\nADDITIONAL METADATA:\n\n${additional_metadata} ` },
            ...history.map(msg => ({ role: msg.role, content: msg.content })),
            { role: "user", content: currentPrompt },
        ];
        // console.log("SystemPrompt: ", messages[0])
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
