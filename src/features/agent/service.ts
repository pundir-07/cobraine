import { pool } from "../../lib/postgres";

interface MessageRecord {
  id: string;
  user_id: number;
  chat_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: Date;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const AMP = "&";
const LT = "<";
const GT = ">";

const SYSTEM_PROMPT =
  "You are a helpful assistant. Answer the user's query concisely and accurately. " +
  "Format your responses using Telegram HTML parse_mode markup, instead of standard markup. " +
  "Use <b> for bold, <i> for italic, <code> for inline code, <pre> for code blocks, " +
  "and <u> for underline. " +
  `Escape literal HTML characters: ${AMP} -> ${AMP}amp;, < -> ${LT}, > -> ${GT}. ` +
  "Do NOT wrap your entire response in a single <b> or <i> tag. " +
  "Use line breaks (\\n) for paragraph separation.";

const MAX_HISTORY_MESSAGES = 20;

export async function ensureUser(
  telegramId: number,
  username?: string,
  firstName?: string,
  lastName?: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO users (telegram_id, username, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telegram_id)
     DO UPDATE SET
       username = COALESCE($2, users.username),
       first_name = COALESCE($3, users.first_name),
       last_name = COALESCE($4, users.last_name),
       updated_at = now()`,
    [telegramId, username ?? null, firstName ?? null, lastName ?? null],
  );
}

export async function saveMessage(
  userId: number,
  chatId: number,
  role: "user" | "assistant" | "system",
  content: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO messages (user_id, chat_id, role, content)
     VALUES ($1, $2, $3, $4)`,
    [userId, chatId, role, content],
  );
}

export async function getConversationHistory(
  userId: number,
  chatId: number,
  limit: number = MAX_HISTORY_MESSAGES,
): Promise<MessageRecord[]> {
  const result = await pool.query<MessageRecord>(
    `SELECT * FROM messages
     WHERE user_id = $1 AND chat_id = $2
     ORDER BY created_at ASC
     LIMIT $3`,
    [userId, chatId, limit],
  );

  return result.rows;
}

export async function buildChatContext(
  userId: number,
  chatId: number,
  currentPrompt: string,
): Promise<ChatMessage[]> {
  const history = await getConversationHistory(userId, chatId);

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];
  console.log('System prompt:',SYSTEM_PROMPT)

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: "user", content: currentPrompt });

  return messages;
}