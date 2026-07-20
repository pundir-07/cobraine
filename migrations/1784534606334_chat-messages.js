/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    pgm.sql(`
        CREATE TABLE chat_messages (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        telegram_chat_id BIGINT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content       TEXT NOT NULL,
        related_item_id UUID REFERENCES items(id) ON DELETE SET NULL, -- if the msg triggered a save
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX idx_chat_messages_user_time ON chat_messages (user_id, created_at DESC);
        `)
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.sql(`
        -- Drop indexes
        DROP INDEX IF EXISTS idx_chat_messages_user_time;

        -- Drop table
        DROP TABLE IF EXISTS chat_messages;
        `)
};
