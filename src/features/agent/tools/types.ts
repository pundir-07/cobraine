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

/**
 * Parses an XML tool call like:
 * <tool_call>
 *   <tool_name>set_reminder</tool_name>
 *   <arguments>
 *     <title>Buy milk</title>
 *     <date>25/12</date>
 *     <time>9am</time>
 *   </arguments>
 * </tool_call>
 */
