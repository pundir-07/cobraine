import { pool } from "../../lib/postgres";
import { buildSystemPrompt } from "./prompt";

interface MessageRecord {
  id: string;
  user_id: string;
  telegram_chat_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: Date;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const MAX_HISTORY_MESSAGES = 20;

/**
 * Upserts a user by telegram_id and returns the user's UUID.
 */
export async function ensureUser(
  telegramId: number,
  username?: string,
  firstName?: string,
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (telegram_id, username, first_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id)
     DO UPDATE SET
       username = COALESCE($2, users.username),
       first_name = COALESCE($3, users.first_name),
       updated_at = now()
     RETURNING id`,
    [telegramId, username ?? null, firstName ?? null],
  );

  return result.rows[0].id;
}

export async function saveMessage(
  userUuid: string,
  telegramChatId: number,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO chat_messages (user_id, telegram_chat_id, role, content)
     VALUES ($1, $2, $3, $4)`,
    [userUuid, telegramChatId, role, content],
  );
}

export async function getConversationHistory(
  userUuid: string,
  telegramChatId: number,
  limit: number = MAX_HISTORY_MESSAGES,
): Promise<MessageRecord[]> {
  const result = await pool.query<MessageRecord>(
    `SELECT * FROM chat_messages
     WHERE user_id = $1 AND telegram_chat_id = $2
     ORDER BY created_at ASC
     LIMIT $3`,
    [userUuid, telegramChatId, limit],
  );

  return result.rows;
}

export async function buildChatContext(
  userUuid: string,
  telegramChatId: number,
  currentPrompt: string,
): Promise<ChatMessage[]> {
  const history = await getConversationHistory(userUuid, telegramChatId);

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
  ];

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: "user", content: currentPrompt });

  return messages;
}