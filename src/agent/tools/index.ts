import { StructuredToolInterface } from '@langchain/core/tools';
import { setReminderTool, listRemindersTool } from './tool.reminder';
import { saveItemTool } from './tool.save_item';
import { semanticSearchTool } from './tool.semantic_search';
import { askUserTool } from './tool.ask_user';
import { saveFileTool } from './tool.save_file';
import { sendFileTool } from './tool.send_file';
import { searchFilesTool } from './tool.search_files';
import { handoverToPlannerTool, handoverToMainAgentTool } from './tool.handover';
import { createPlanTool, createCheckpointTool } from './tool.plan';

/**
 * Build the full set of agent tools for a specific user session.
 * Tools that require userId / chatId capture them via closure.
 *
 * @param telegramId - Telegram user ID (for domain service calls)
 * @param chatId     - Telegram chat ID (for reminder delivery)
 */
export function buildMainAgentTools(
    telegramId: number,
    chatId: number,
): StructuredToolInterface[] {
    return [
        listRemindersTool(telegramId),
        saveItemTool(telegramId),
        semanticSearchTool(telegramId),
        askUserTool,
        saveFileTool(telegramId),
        sendFileTool(chatId),
        searchFilesTool(telegramId),
        handoverToPlannerTool,
    ];
}

export function buildGoalAgentTools(
    telegramId: number,
    chatId: number,
): StructuredToolInterface[] {
    return [
        createPlanTool(telegramId),
        createCheckpointTool,
        setReminderTool(telegramId, chatId),
        listRemindersTool(telegramId),
        handoverToMainAgentTool,
        askUserTool,
    ];
}

export function buildAllTools(
    telegramId: number,
    chatId: number,
): StructuredToolInterface[] {
    return [
        ...buildMainAgentTools(telegramId, chatId),
        ...buildGoalAgentTools(telegramId, chatId),
    ];
}

