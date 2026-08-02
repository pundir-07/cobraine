import dotenv from "dotenv";
dotenv.config();

export const config = {
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
      process.env.DATABASE_URL,
    maxPool: 20,
  },
  deepseek: {
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    defaultModel: process.env.DEEPSEEK_DEFAULT_MODEL ?? "deepseek-chat",
  }
} as const;
