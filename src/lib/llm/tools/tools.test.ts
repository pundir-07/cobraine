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
});
