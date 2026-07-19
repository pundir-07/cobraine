import { config } from "../../config";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

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

export class OpenRouterLLM {
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
}

export const openRouter = new OpenRouterLLM();