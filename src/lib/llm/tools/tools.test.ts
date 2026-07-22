// src/utils/math.test.ts
import { describe, expect, it, beforeAll } from "vitest";
import { toolsManager } from ".";

describe("tools", () => {
    beforeAll(async () => {
        await toolsManager.init();
    });

    it("gets available tools from files", () => {
        toolsManager.getToolsList()
    });
    
    it.skip("gets the compiled tools instructions for all enabled tools", () => {
        toolsManager.getToolsInstructions()
    })
});
