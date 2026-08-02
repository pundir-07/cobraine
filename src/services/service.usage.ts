import { pool } from '../lib/postgres';
import { ProviderService, ProviderConfig } from './service.provider';

const FREE_MESSAGE_LIMIT = 10;

export interface UsageCheckResult {
    /** Whether the user is allowed to invoke the LLM. */
    allowed: boolean;
    /** If allowed, the provider config to use (undefined = use shared key). */
    providerConfig?: ProviderConfig;
    /** If not allowed, the reason to display to the user. */
    reason?: string;
}

/**
 * Gating service — determines whether a user can invoke the LLM and
 * which credentials to use.
 *
 * Decision tree:
 *   1. Has active provider_config? → allowed, use user's key
 *   2. free_messages_used < 10?    → allowed, use shared key, increment counter
 *   3. Otherwise                   → blocked, return reason
 *
 * Only user-initiated messages should call this. Tool-loop LLM iterations
 * are NOT counted against the free quota.
 */
export class UsageService {
    static async checkAndConsume(userUuid: string): Promise<UsageCheckResult> {
        // 1. Check for an active provider config
        const providerConfig = await ProviderService.getActiveConfig(userUuid);
        if (providerConfig) {
            return { allowed: true, providerConfig };
        }

        // 2. Check and atomically increment the free message counter
        //    The WHERE clause ensures we never exceed the limit even under concurrency.
        const result = await pool.query(
            `UPDATE users
             SET free_messages_used = free_messages_used + 1,
                 updated_at = now()
             WHERE id = $1
               AND free_messages_used < $2
             RETURNING free_messages_used`,
            [userUuid, FREE_MESSAGE_LIMIT],
        );

        if (result.rowCount && result.rowCount > 0) {
            return { allowed: true };
        }

        // 3. Quota exhausted, no provider configured
        return {
            allowed: false,
            reason:
                "You've used your 10 free AI messages. " +
                'Add your own API key in Settings to continue.',
        };
    }

    /**
     * Get the current free message count without consuming.
     * Useful for displaying usage stats.
     */
    static async getFreeMessagesUsed(userUuid: string): Promise<number> {
        const result = await pool.query(
            `SELECT free_messages_used FROM users WHERE id = $1`,
            [userUuid],
        );
        return result.rows[0]?.free_messages_used ?? 0;
    }
}
