import { pool } from "../lib/postgres";

/**
 * Message record as stored in the database.
 */
export type MessageRecord = {
    id: string;
    userId: string;
    telegramChatId: number;
    role: "user" | "assistant";
    content: string;
    relatedItemId?: string;
    createdAt: Date;
};

/**
 * Service for managing chat messages.
 * Handles saving and retrieving conversation history.
 */
export class MessageService {
    /**
     * Saves a chat message to the database.
     *
     * @param userUuid - The user's UUID
     * @param telegramChatId - The Telegram chat ID
     * @param role - The message role ("user" or "assistant")
     * @param content - The message content
     * @param relatedItemId - Optional related item ID
     */
    static async saveMessage(
        userUuid: string,
        telegramChatId: number,
        role: "user" | "assistant",
        content: string,
        relatedItemId?: string,
    ): Promise<void> {
        await pool.query(
            `INSERT INTO chat_messages (user_id, telegram_chat_id, role, content, related_item_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [userUuid, telegramChatId, role, content, relatedItemId ?? null],
        );
    }

    /**
     * Retrieves conversation history for a user in a specific chat.
     *
     * @param userUuid - The user's UUID
     * @param telegramChatId - The Telegram chat ID
     * @param limit - Maximum number of messages to retrieve (default: 20)
     * @returns Array of MessageRecord objects, ordered by creation time
     */
    static async getConversationHistory(
        userUuid: string,
        telegramChatId: number,
        limit: number = 20, // Disabled for now
    ): Promise<MessageRecord[]> {
        const result = await pool.query<MessageRecord>(
            `SELECT * FROM chat_messages
            WHERE user_id = $1 AND telegram_chat_id = $2
            ORDER BY created_at ASC`,
            [userUuid, telegramChatId],
        );

        return result.rows;
    }
}
