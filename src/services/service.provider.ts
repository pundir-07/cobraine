import { pool } from '../lib/postgres';
import { encrypt, decrypt } from '../lib/crypto';

export interface ProviderConfig {
    id: string;
    userId: string;
    provider: string;
    apiKey: string;        // decrypted
    model: string;
    isActive: boolean;
}

/**
 * CRUD service for user LLM provider configurations.
 *
 * API keys are encrypted at rest using AES-256-GCM (see lib/crypto.ts).
 * All public methods return decrypted configs — the encryption layer is
 * completely transparent to callers.
 */
export class ProviderService {
    /**
     * Get the active provider config for a user, if one exists.
     * Returns the first active config (currently one per provider, but
     * the query handles multiple by picking the most recently updated).
     */
    static async getActiveConfig(userUuid: string): Promise<ProviderConfig | null> {
        const result = await pool.query(
            `SELECT id, user_id, provider, encrypted_api_key, model, is_active
             FROM provider_configs
             WHERE user_id = $1 AND is_active = true
             ORDER BY updated_at DESC
             LIMIT 1`,
            [userUuid],
        );

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            id: row.id,
            userId: row.user_id,
            provider: row.provider,
            apiKey: decrypt(row.encrypted_api_key),
            model: row.model,
            isActive: row.is_active,
        };
    }

    /**
     * Insert or update a provider config for a user.
     * Encrypts the API key before storage.
     */
    static async upsertConfig(
        userUuid: string,
        provider: string,
        apiKey: string,
        model: string,
    ): Promise<ProviderConfig> {
        const encryptedKey = encrypt(apiKey);

        const result = await pool.query(
            `INSERT INTO provider_configs (user_id, provider, encrypted_api_key, model)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, provider)
             DO UPDATE SET
                encrypted_api_key = $3,
                model = $4,
                is_active = true,
                updated_at = now()
             RETURNING id, user_id, provider, encrypted_api_key, model, is_active`,
            [userUuid, provider, encryptedKey, model],
        );

        const row = result.rows[0];
        return {
            id: row.id,
            userId: row.user_id,
            provider: row.provider,
            apiKey, // return the original plaintext, not the encrypted version
            model: row.model,
            isActive: row.is_active,
        };
    }

    /**
     * Soft-disable a provider config (set is_active = false).
     */
    static async deactivateConfig(userUuid: string, provider: string): Promise<void> {
        await pool.query(
            `UPDATE provider_configs
             SET is_active = false, updated_at = now()
             WHERE user_id = $1 AND provider = $2`,
            [userUuid, provider],
        );
    }

    /**
     * Hard-delete a provider config.
     */
    static async deleteConfig(userUuid: string, provider: string): Promise<void> {
        await pool.query(
            `DELETE FROM provider_configs WHERE user_id = $1 AND provider = $2`,
            [userUuid, provider],
        );
    }
}
