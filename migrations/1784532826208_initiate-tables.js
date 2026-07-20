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
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()
        CREATE EXTENSION IF NOT EXISTS "vector";    -- pgvector

        CREATE TYPE item_type AS ENUM (
        'note', 'reminder', 'youtube_link', 'pdf', 'document', 'photo', 'text_message'
        );

        CREATE TYPE item_status AS ENUM ('active', 'archived', 'deleted');

        CREATE TABLE users (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        telegram_id     BIGINT UNIQUE NOT NULL,
        username        TEXT,
        first_name      TEXT,
        timezone        TEXT DEFAULT 'UTC',       -- needed for reminder scheduling
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE items (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type            item_type NOT NULL,
        title           TEXT,                     -- auto-generated or user-given
        raw_content     TEXT,                     -- note text, message text, etc.
        source_url      TEXT,                     -- youtube url, external link
        telegram_file_id TEXT,                    -- for re-fetching from Telegram
        file_path       TEXT,                     -- storage path (S3/local) if downloaded
        mime_type       TEXT,
        status          item_status NOT NULL DEFAULT 'active',
        metadata        JSONB NOT NULL DEFAULT '{}',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX idx_items_user_type   ON items (user_id, type);
        CREATE INDEX idx_items_user_status ON items (user_id, status);
        CREATE INDEX idx_items_metadata    ON items USING GIN (metadata);
        CREATE INDEX idx_items_content_fts ON items USING GIN (to_tsvector('english', coalesce(raw_content, '')));
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
        DROP INDEX IF EXISTS idx_items_content_fts;
        DROP INDEX IF EXISTS idx_items_metadata;
        DROP INDEX IF EXISTS idx_items_user_status;
        DROP INDEX IF EXISTS idx_items_user_type;

        -- Drop tables
        DROP TABLE IF EXISTS items;
        DROP TABLE IF EXISTS users;

        -- Drop enum types
        DROP TYPE IF EXISTS item_status;
        DROP TYPE IF EXISTS item_type;

        -- Drop extensions (only if nothing else depends on them)
        DROP EXTENSION IF EXISTS vector;
        DROP EXTENSION IF EXISTS pgcrypto;
        `)
};
