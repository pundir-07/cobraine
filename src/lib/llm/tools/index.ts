import { readdirSync } from "node:fs";
import { ToolDefinition } from "../../../types/types.tools";


export class ToolsManager {
  tools: Record<string, ToolDefinition> = {};
  isInitialized = false;

  async init() {
    if (this.isInitialized) return;

    const files = readdirSync(__dirname, { withFileTypes: true });
    const toolFiles = files.filter(file => file.name.endsWith(".tool.ts"));

    for (const file of toolFiles) {
      const imp = await import(`./${file.name}`) as Record<string, ToolDefinition>;
      for (const tool of Object.values(imp)) {
        if (!tool.disabled && tool.definition.type === "function") {
          this.tools[tool.definition.function.name] = tool;
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
  getNativeTools() {
    if (!this.isInitialized) throw new Error("ToolsManager is not initialized! Call init() at startup.");
    return this.getToolsList().map(t => t.definition);
  }
}

export const toolsManager = new ToolsManager();

export { ToolDefinition } from "../../../types/types.tools";