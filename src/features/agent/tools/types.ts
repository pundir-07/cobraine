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
export function parseToolCallXml(xml: string): { tool: string; arguments: Record<string, unknown> } | null {
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