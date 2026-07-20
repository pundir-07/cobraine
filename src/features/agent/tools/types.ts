export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(
    args: Record<string, unknown>,
    userId: number,
    chatId: number,
  ): Promise<string>;
}

export interface ToolCallResponse {
  type: "tool_call";
  tool: string;
  arguments: Record<string, unknown>;
}

export interface TextResponse {
  type: "text";
  content: string;
}

export type LlmResponse = ToolCallResponse | TextResponse;