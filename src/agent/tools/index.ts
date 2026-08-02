import { StructuredToolInterface } from '@langchain/core/tools';
import { setReminderTool, listRemindersTool } from './tool.reminder';
import { saveItemTool } from './tool.save_item';
import { semanticSearchTool } from './tool.semantic_search';
import { askUserTool } from './tool.ask_user';
import { saveFileTool } from './tool.save_file';
import { sendFileTool } from './tool.send_file';
import { searchFilesTool } from './tool.search_files';

/**
 * Build the full set of agent tools for a specific user session.
 * Tools that require userId / chatId capture them via closure.
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
    ];
}

