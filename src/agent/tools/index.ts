import { StructuredToolInterface } from '@langchain/core/tools';
import { setReminderTool, listRemindersTool } from './tool.reminder';
import { saveItemTool } from './tool.save_item';
import { semanticSearchTool } from './tool.semantic_search';
import { askUserTool } from './tool.ask_user';
import { saveFileTool } from './tool.save_file';
import { sendFileTool } from './tool.send_file';
import { searchFilesTool } from './tool.search_files';
import { updateFileTool } from './tool.update_file';
import { deleteFileTool } from './tool.delete_file';
import { deleteFilesByTypeTool } from './tool.delete_files_by_type';
import { fetchFilesTool } from './tool.fetch_files';
import { createPlanTool, createCheckpointTool } from './tool.plan';
import { setUserTimezoneTool } from './tool.set_timezone';

/**
 * Build the complete set of agent tools for a specific user session.
 * All tools (general + goal/plan) are available to the single unified agent.
 *
 * @param telegramId - Telegram user ID (for domain service calls)
 * @param chatId     - Telegram chat ID (for reminder delivery)
 */
export function buildAgentTools(
    telegramId: number,
    chatId: number,
): StructuredToolInterface[] {
    return [
        setReminderTool(telegramId, chatId),
        listRemindersTool(telegramId),
        saveItemTool(telegramId),
        semanticSearchTool(telegramId),
        askUserTool,
        saveFileTool(telegramId),
        sendFileTool(chatId),
        searchFilesTool(telegramId),
        updateFileTool(telegramId),
        deleteFileTool(telegramId),
        deleteFilesByTypeTool(telegramId),
        fetchFilesTool(telegramId),
        createPlanTool(telegramId),
        createCheckpointTool,
        setUserTimezoneTool(telegramId),
    ];
}
