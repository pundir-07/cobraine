import { readdirSync } from "node:fs";
import { ToolDefinition } from "../../../types/types.tools";


function ESC(name: string): string {
  return "&" + name + ";";
}


export class ToolsManager {
  tools: Record<string, ToolDefinition> = {};
  isInitialized = false;

  async init() {
    if (this.isInitialized) return;

    const files = readdirSync(__dirname, { withFileTypes: true });
    const toolFiles = files.filter(file => file.name.endsWith(".tool.ts"));

    for (const file of toolFiles) {
      const imp = await import(`./${file.name}`) as Record<string, ToolDefinition>;
      for (const [key, tool] of Object.entries(imp)) {
        if (!tool.disabled) {
          this.tools[key] = tool;
        }
      }
    }
    
    this.isInitialized = true;
  }

  getToolByName(name: string): ToolDefinition {
    if (!this.isInitialized) throw new Error("ToolsManager is not initialized! Call init() at startup.");
    return this.tools[name];
  }
  getToolsList(): ToolDefinition[] {
    if (!this.isInitialized) throw new Error("ToolsManager is not initialized! Call init() at startup.");
    return Object.values(this.tools);
  }
  getToolsInstructions(): string {
    const availableTools = this.getToolsList()
    return [
      "MANDATORY TOOL CALLS — You MUST ALWAYS respond with an XML tool call.",
      "Never send plain text. Every single response must be wrapped in a <tool_call> block.",
      "",
      "AVAILABLE TOOLS:",
      "",
      availableTools.map((tool) => {
        const params = tool.parameters
          .map((p) => {
            const required = p.required ? " (required)" : "";
            const enum_ = p.enum ? ` [${p.enum.join(", ")}]` : "";
            return `    - ${p.name}${required}: ${p.description}${enum_}`;
          })
          .join("\n");
        return [
          `  <tool_name>${tool.name}</tool_name>`,
          `  ${tool.description}`,
          params ? `  Parameters:\n${params}` : "  Parameters: none",
        ].join("\n");
      }).join("\n\n"),
      "",
      "XML RESPONSE FORMAT (REQUIRED):",
      "Your entire response must be ONLY this XML block, nothing before or after:",
      "<tool_call>",
      "  <tool_name>tool_name_here</tool_name>",
      "  <arguments>",
      "    <param1_name>value1</param1_name>",
      "    <param2_name>value2</param2_name>",
      "  </arguments>",
      "</tool_call>",
      "",
      "EXAMPLES:",
      "",
      "To send a normal chat message:",
      "<tool_call>",
      "  <tool_name>text_response</tool_name>",
      "  <arguments>",
      "    <content>Hello! How can I help you today?</content>",
      "  </arguments>",
      "</tool_call>",
      "",
      "To set a reminder:",
      "<tool_call>",
      "  <tool_name>set_reminder</tool_name>",
      "  <arguments>",
      "    <title>Buy groceries</title>",
      "    <date>25/12/2026</date>",
      "    <time>9am</time>",
      "  </arguments>",
      "</tool_call>",
      "",
      "CRITICAL RULES:",
      "- ALWAYS wrap your response in <tool_call> ... </tool_call>",
      "- NEVER include markdown code fences (no \`\`\`)",
      "- NEVER include any text before <tool_call> or after </tool_call>",
      "- If a parameter is not needed, omit the tag entirely",
      "- Use Telegram HTML formatting inside text content: <b>, <i>, <code>, <pre>",
      "Escape literal HTML chars: & -> " + ESC("amp") + ", < -> " + ESC("lt") + ", > -> " + ESC("gt") + ".",
    ].join("\n");
  }
}

export const toolsManager = new ToolsManager();

export { ToolDefinition, ToolParameter, } from "../../../types/types.tools";