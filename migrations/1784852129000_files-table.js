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
        CREATE TYPE file_type AS ENUM ('photo', 'document', 'video', 'audio', 'voice');

        CREATE TABLE files (
            id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type                  file_type NOT NULL,
            description           TEXT NOT NULL,
            description_embedding VECTOR(768),
            telegram_file_id      TEXT,
            local_path            TEXT,
            original_filename     TEXT,
            mime_type             TEXT,
            file_size_bytes       BIGINT,
            extracted_text        TEXT,
            status                TEXT NOT NULL DEFAULT 'active',
            created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX idx_files_user      ON files (user_id);
        CREATE INDEX idx_files_user_type ON files (user_id, type);
        CREATE INDEX idx_files_user_status ON files (user_id, status);

        -- HNSW index for fast approximate cosine similarity search on description
        -- 768 dims matches nomic-embed-text (same model used by chunks/embeddings)
        CREATE INDEX idx_files_description_embedding
            ON files USING hnsw (description_embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
    `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.sql(`
        DROP INDEX IF EXISTS idx_files_description_embedding;
        DROP INDEX IF EXISTS idx_files_user_status;
        DROP INDEX IF EXISTS idx_files_user_type;
        DROP INDEX IF EXISTS idx_files_user;
        DROP TABLE IF EXISTS files;
        DROP TYPE IF EXISTS file_type;
    `);
};
