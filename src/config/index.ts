import dotenv from "dotenv";
import consola from "consola";
import chalk from "chalk"
dotenv.config();


export const config = {
  botToken: process.env[`BOT_TOKEN_${process.env.NODE_ENV}`],
  openrouter: {
    baseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    freeEndpoint: "/chat/completions",
    defaultModel: process.env.OPENROUTER_DEFAULT_MODEL ?? "openrouter/free",
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text",
  },
  postgres: {
    connectionString:
      process.env[`DATABASE_URL_${process.env.NODE_ENV}`],
    maxPool: 20,
  },
  deepseek: {
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    defaultModel: process.env.DEEPSEEK_DEFAULT_MODEL ?? "deepseek-chat",
  },
  voyage: {
    apiKey: process.env.VOYAGE_API_KEY ?? "",
    embeddingModel: process.env.VOYAGE_EMBEDDING_MODEL ?? "voyage-3",
  }
} as const;

function checkEnvironment() {
  if (!config.botToken) {
    console.error("BOT_TOKEN is required in the environment")
    throw new Error("BOT_TOKEN is required in the environment");
  }
  if (!config.postgres.connectionString) {
    console.error("Databse Connection String is required in the environment")
    throw new Error("Database Connection String is required in the environment");

  }
  let db
  if (config.postgres.connectionString.includes('supabase')) {
    db = "Supabase"
  } else {
    db = "Postgres Local"
  }
  consola.box(chalk.cyan(`
    Environment: ${process.env.NODE_ENV}
    Database: ${db}
    `))
}
checkEnvironment()