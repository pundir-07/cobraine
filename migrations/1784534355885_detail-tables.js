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
        -- Reminders (type = 'reminder')
        CREATE TYPE reminder_status AS ENUM ('pending', 'sent', 'completed', 'cancelled');

        CREATE TABLE reminders (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id       UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        remind_at     TIMESTAMPTZ NOT NULL,
        recurrence    JSONB,                      -- e.g. {"freq":"weekly","byday":["MO"]} (RRULE-like)
        status        reminder_status NOT NULL DEFAULT 'pending',
        sent_at       TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX idx_reminders_due ON reminders (remind_at) WHERE status = 'pending';

        -- YouTube links (type = 'youtube_link')
        CREATE TABLE youtube_metadata (
        item_id             UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
        video_id            TEXT NOT NULL,
        channel_title       TEXT,
        duration_seconds    INT,
        transcript_fetched  BOOLEAN NOT NULL DEFAULT false,
        thumbnail_url       TEXT
        );

        -- Files: PDFs, documents, photos (type = 'pdf' | 'document' | 'photo')
        CREATE TABLE file_metadata (
        item_id             UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
        original_filename   TEXT,
        file_size_bytes     BIGINT,
        page_count          INT,                  -- pdfs
        extracted_text      TEXT,                 -- full OCR/parsed text before chunking
        processing_status   TEXT DEFAULT 'pending' -- pending | processing | done | failed
        );

        -- Tags (user-defined or auto-suggested)
        CREATE TABLE tags (
        id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name      TEXT NOT NULL,
        UNIQUE (user_id, name)
        );

        CREATE TABLE item_tags (
        item_id   UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        tag_id    UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (item_id, tag_id)
        );
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
        DROP INDEX IF EXISTS idx_reminders_due;

        -- Drop tables (reverse dependency order)
        DROP TABLE IF EXISTS item_tags;
        DROP TABLE IF EXISTS tags;
        DROP TABLE IF EXISTS file_metadata;
        DROP TABLE IF EXISTS youtube_metadata;
        DROP TABLE IF EXISTS reminders;

        -- Drop enum types
        DROP TYPE IF EXISTS reminder_status;
        `)
};
