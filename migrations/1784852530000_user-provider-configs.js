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
        -- Track free message usage per user
        ALTER TABLE users
            ADD COLUMN free_messages_used INT NOT NULL DEFAULT 0;

        -- Per-user LLM provider credentials
        CREATE TABLE provider_configs (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider          TEXT NOT NULL,
            encrypted_api_key TEXT NOT NULL,
            model             TEXT NOT NULL,
            is_active         BOOLEAN NOT NULL DEFAULT true,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (user_id, provider)
        );

        CREATE INDEX idx_provider_configs_user ON provider_configs (user_id);
        CREATE INDEX idx_provider_configs_active ON provider_configs (user_id) WHERE is_active = true;
    `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.sql(`
        DROP INDEX IF EXISTS idx_provider_configs_active;
        DROP INDEX IF EXISTS idx_provider_configs_user;
        DROP TABLE IF EXISTS provider_configs;
        ALTER TABLE users DROP COLUMN IF EXISTS free_messages_used;
    `);
};
