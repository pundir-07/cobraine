import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("users", {
    id: {
      type: "serial",
      primaryKey: true,
    },
    telegram_id: {
      type: "bigint",
      notNull: true,
      unique: true,
    },
    username: {
      type: "varchar(255)",
    },
    first_name: {
      type: "varchar(255)",
    },
    last_name: {
      type: "varchar(255)",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createTable("messages", {
    id: {
      type: "uuid",
      notNull: true,
      default: pgm.func("gen_random_uuid()"),
      primaryKey: true,
    },
    user_id: {
      type: "bigint",
      notNull: true,
      references: "users(telegram_id)",
      onDelete: "CASCADE",
    },
    chat_id: {
      type: "bigint",
      notNull: true,
    },
    role: {
      type: "varchar(20)",
      notNull: true,
      check: "role IN ('user', 'assistant', 'system')",
    },
    content: {
      type: "text",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("messages", ["user_id", "chat_id", "created_at"]);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("messages");
  pgm.dropTable("users");
}