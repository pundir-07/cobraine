import { config } from "../../config";

interface VoyageEmbeddingResponse {
    data: Array<{
        embedding: number[];
        index: number;
    }>;
}

export class VoyageEmbedding {
    private apiKey: string;
    private baseUrl: string = 'https://api.voyageai.com/v1/embeddings';
    private model: string;

    constructor() {
        this.apiKey = config.voyage.apiKey;
        this.model = config.voyage.embeddingModel;

        if (!this.apiKey) {
            throw new Error("VOYAGE_API_KEY environment variable is missing.");
        }
    }

    async embed(text: string): Promise<number[]> {
        const response = await fetch(this.baseUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                input: [text],
                model: this.model,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Voyage API error (${response.status}): ${errorText}`);
        }

        const data: VoyageEmbeddingResponse = await response.json();
        return data.data[0].embedding;
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) return [];

        const response = await fetch(this.baseUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                input: texts,
                model: this.model,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Voyage API error (${response.status}): ${errorText}`);
        }

        const data: VoyageEmbeddingResponse = await response.json();
        
        // Ensure embeddings are ordered correctly according to the original texts array
        const embeddings: number[][] = new Array(texts.length);
        for (const item of data.data) {
            embeddings[item.index] = item.embedding;
        }
        
        return embeddings;
    }
}

export const voyageEmbedding = new VoyageEmbedding();
