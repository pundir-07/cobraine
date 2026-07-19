import { config } from "../../config";

interface EmbeddingResponse {
  embedding: number[];
}

interface EmbeddingsBatchResponse {
  embeddings: number[][];
}

export class OllamaEmbedding {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = config.ollama.baseUrl;
    this.model = config.ollama.embeddingModel;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(
      `${this.baseUrl}/api/embeddings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama embedding error (${response.status}): ${errorText}`,
      );
    }

    const data: EmbeddingResponse = await response.json();
    return data.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
      const embedding = await this.embed(text);
      results.push(embedding);
    }

    return results;
  }
}

export const ollamaEmbedding = new OllamaEmbedding();