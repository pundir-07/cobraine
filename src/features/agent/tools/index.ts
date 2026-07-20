import { ToolDefinition } from "./types";
import { setReminderTool, listRemindersTool } from "./reminder";

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  setReminderTool,
  listRemindersTool,
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return AVAILABLE_TOOLS.find((t) => t.name === name);
}

export function getToolsInstructions(): string {
  return [
    "TOOLS:",
    "You have access to the following tools. When the user's request requires one, respond with a JSON object instead of free text.",
    "",
    AVAILABLE_TOOLS.map((tool) => {
      const params = tool.parameters
        .map((p) => {
          const required = p.required ? " (required)" : "";
          const enum_ = p.enum ? ` [${p.enum.join(", ")}]` : "";
          return `  - ${p.name}${required}: ${p.description}${enum_}`;
        })
        .join("\n");
      return [
        `\`${tool.name}\`: ${tool.description}`,
        params ? `Parameters:\n${params}` : "Parameters: none",
      ].join("\n");
    }).join("\n\n"),
    "",
    "JSON RESPONSE FORMAT:",
    "When calling a tool, respond with a JSON object in this exact format (no markdown, no code fences, no extra text):",
    `{"type":"tool_call","tool":"<tool_name>","arguments":{<parameters>}}`,
    "",
    "When responding normally (no tool needed), respond with a JSON object in this exact format:",
    `{"type":"text","content":"<your response with Telegram HTML markup>"}`,
    "",
    "IMPORTANT: Always respond with valid JSON. Never include markdown code fences or any text outside the JSON object. The response MUST be parseable as JSON.",
  ].join("\n");
}

export { ToolDefinition, ToolParameter, ToolCallResponse, TextResponse, LlmResponse } from "./types";