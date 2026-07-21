import { buildSystemPrompt } from "../features/agent/prompt";
import { ChatMessage } from "../types/types.message";
import { MessageService } from "./service.message";
import { config } from "../config";


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

    async continueUserChat(userUuid: string,
        telegramChatId: number,
        currentPrompt: string): Promise<string> {
        const messages = await this.buildChatContext(userUuid, telegramChatId, currentPrompt)
        return await this.chat(messages)
    }

    private async buildChatContext(
        userUuid: string,
        telegramChatId: number,
        currentPrompt: string,
    ): Promise<ChatMessage[]> {
        const history = await MessageService.getConversationHistory(userUuid, telegramChatId);

        const messages: ChatMessage[] = [
            { role: "system", content: buildSystemPrompt() },
        ];

        for (const msg of history) {
            messages.push({ role: msg.role, content: msg.content });
        }

        messages.push({ role: "user", content: currentPrompt });

        return messages;
    }
}
export const OpenRouterAgentService = new AgentService()

