import { ToolDefinition } from "./types";
import { setReminderTool, listRemindersTool } from "./reminder";

function ESC(name: string): string {
  return "&" + name + ";";
}

export function getToolByName(name: string): ToolDefinition | undefined {
  return AVAILABLE_TOOLS.find((t) => t.name === name);
}

// A catch-all tool for when the LLM just wants to respond with text.
// The LLM must ALWAYS use this if no other tool is appropriate.
const textResponseTool: ToolDefinition = {
  name: "text_response",
  description:
    "Send a normal text reply to the user. Use this when no other tool fits.",
  parameters: [
    {
      name: "content",
      type: "string",
      description: "Your response to the user, formatted with Telegram HTML.",
      required: true,
    },
  ],
  async execute(args) {
    return String(args.content ?? "");
  },
};

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  textResponseTool,
  setReminderTool,
  listRemindersTool,
];

export function getToolsInstructions(): string {
  return [
    "MANDATORY TOOL CALLS — You MUST ALWAYS respond with an XML tool call.",
    "Never send plain text. Every single response must be wrapped in a <tool_call> block.",
    "",
    "AVAILABLE TOOLS:",
    "",
    AVAILABLE_TOOLS.map((tool) => {
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

export { ToolDefinition, ToolParameter, parseToolCallXml } from "./types";