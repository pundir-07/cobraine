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
         CREATE TABLE chunks (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id       UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        chunk_index   INT NOT NULL,
        content       TEXT NOT NULL,
        token_count   INT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (item_id, chunk_index)
        );

        -- 768 = nomic-embed-text (Ollama) dims. If you ever switch models, dimension
        -- must match exactly or inserts will fail — pgvector columns are fixed-width.
        CREATE TABLE embeddings (
        chunk_id      UUID PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
        embedding     VECTOR(768) NOT NULL,
        model         TEXT NOT NULL DEFAULT 'nomic-embed-text',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        -- HNSW index for fast approximate cosine search (pgvector >= 0.5)
        CREATE INDEX idx_embeddings_hnsw
        ON embeddings USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
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
        DROP INDEX IF EXISTS idx_embeddings_hnsw;

        -- Drop tables (reverse dependency order)
        DROP TABLE IF EXISTS embeddings;
        DROP TABLE IF EXISTS chunks;
        `)
};
