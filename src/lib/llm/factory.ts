import { ChatOpenAI } from '@langchain/openai';
import { ProviderConfig } from '../../services/service.provider';
import { config } from '../../config';

/**
 * Well-known base URLs for supported providers.
 * All must expose an OpenAI-compatible chat completions endpoint.
 */
const PROVIDER_BASE_URLS: Record<string, string> = {
    openrouter: 'https://openrouter.ai/api/v1',
    openai: 'https://api.openai.com/v1',
    together: 'https://api.together.xyz/v1',
    groq: 'https://api.groq.com/openai/v1',
    deepseek: 'https://api.deepseek.com/v1',
};

/**
 * Build a ChatOpenAI instance for a specific invocation.
 *
 * Two modes:
 *   1. User config provided → use their key, model, and provider base URL
 *   2. No config (free tier) → use the shared Cobraine OpenRouter key
 *
 * The returned instance is short-lived — created per-request, not cached.
 * This avoids stale credentials if a user rotates their key.
 */
export function buildLLM(providerConfig?: ProviderConfig): ChatOpenAI {
    if (providerConfig) {
        const baseURL =
            PROVIDER_BASE_URLS[providerConfig.provider] ??
            PROVIDER_BASE_URLS['openrouter']; // safe fallback

        return new ChatOpenAI({
            model: providerConfig.model,
            apiKey: providerConfig.apiKey,
            configuration: { baseURL },
            temperature: 0,
        });
    }

    // Free tier — shared Cobraine key
    return new ChatOpenAI({
        model: config.openrouter.defaultModel,
        apiKey: config.openrouter.apiKey,
        configuration: {
            baseURL: config.openrouter.baseUrl,
        },
        temperature: 0,
    });
}
