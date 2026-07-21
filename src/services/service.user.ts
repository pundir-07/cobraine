import { pool } from "../lib/postgres";

/**
 * User record as stored in the database.
 */
export type UserRecord = {
    id: string;
    telegramId: number;
    username: string | null;
    firstName: string | null;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
};

/**
 * Service for managing user data.
 * Handles upserting, retrieval, and removal of users.
 */
export class UserService {
    /**
     * Upserts a user by telegram_id and returns the user's UUID.
     * If the user exists, updates username/firstName if provided.
     *
     * @param telegramId - The Telegram user ID
     * @param username - Optional username to set/update
     * @param firstName - Optional first name to set/update
     * @returns The user's UUID
     */
    static async upsertUser(
        telegramId: number,
        username?: string,
        firstName?: string,
    ): Promise<string> {
        const result = await pool.query<{ id: string }>(
            `INSERT INTO users (telegram_id, username, first_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (telegram_id)
             DO UPDATE SET
               username = COALESCE($2, users.username),
               first_name = COALESCE($3, users.first_name),
               updated_at = now()
             RETURNING id`,
            [telegramId, username ?? null, firstName ?? null],
        );

        return result.rows[0].id;
    }

    /**
     * Retrieves a user by their Telegram ID.
     *
     * @param telegramId - The Telegram user ID
     * @returns The UserRecord if found, null otherwise
     */
    static async getUserByTelegramId(telegramId: number): Promise<UserRecord | null> {
        const result = await pool.query<UserRecord>(
            `SELECT id, telegram_id as "telegramId", username, first_name as "firstName", 
                    timezone, created_at as "createdAt", updated_at as "updatedAt"
             FROM users
             WHERE telegram_id = $1`,
            [telegramId],
        );

        return result.rows[0] ?? null;
    }

    /**
     * Retrieves a user by their UUID.
     *
     * @param id - The user's UUID
     * @returns The UserRecord if found, null otherwise
     */
    static async getUserById(id: string): Promise<UserRecord | null> {
        const result = await pool.query<UserRecord>(
            `SELECT id, telegram_id as "telegramId", username, first_name as "firstName",
                    timezone, created_at as "createdAt", updated_at as "updatedAt"
             FROM users
             WHERE id = $1`,
            [id],
        );

        return result.rows[0] ?? null;
    }

    /**
     * Removes a user by their Telegram ID.
     *
     * @param telegramId - The Telegram user ID to remove
     */
    static async removeUser(telegramId: number): Promise<void> {
        await pool.query(`DELETE FROM users WHERE telegram_id = $1`, [telegramId]);
    }
}