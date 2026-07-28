import { MemorySaver } from '@langchain/langgraph';

/**
 * Single in-process checkpointer shared across all graph invocations.
 * Persists interrupted graph state between Telegram messages for the same chatId.
 *
 * The thread_id used with this checkpointer is the Telegram chatId (string).
 * This can be replaced with a Postgres checkpointer later for multi-process durability.
 */
export const checkpointer = new MemorySaver();
