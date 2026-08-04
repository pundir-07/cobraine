import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { pool } from '../../lib/postgres';

/**
 * Validates that a string is a recognized IANA timezone identifier.
 * Uses Intl.supportedValuesOf('timeZone') which is available in Node 18+.
 */
function isValidTimezone(tz: string): boolean {
    try {
        const supported = Intl.supportedValuesOf('timeZone');
        return supported.includes(tz);
    } catch {
        // Fallback: attempt to create a formatter — throws on invalid tz
        try {
            Intl.DateTimeFormat(undefined, { timeZone: tz });
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Tool that lets the agent persist the user's IANA timezone.
 * Called when the agent detects the timezone is UNSET and asks the user.
 */
export const setUserTimezoneTool = (telegramId: number) =>
    tool(
        async ({ timezone }) => {
            if (!isValidTimezone(timezone)) {
                return `"${timezone}" is not a valid IANA timezone. Examples: Asia/Kolkata, America/New_York, Europe/London, US/Pacific. Ask the user to try again.`;
            }

            await pool.query(
                `UPDATE users SET timezone = $1, updated_at = now() WHERE telegram_id = $2`,
                [timezone, telegramId],
            );

            return `Timezone set to ${timezone}. All reminders and times will now be shown in this timezone.`;
        },
        {
            name: 'set_user_timezone',
            description:
                'Set the user\'s IANA timezone (e.g. "Asia/Kolkata", "America/New_York"). ' +
                'Call this after asking the user for their timezone when it is not configured yet.',
            schema: z.object({
                timezone: z
                    .string()
                    .describe(
                        'IANA timezone identifier, e.g. "Asia/Kolkata", "America/New_York", "Europe/London"',
                    ),
            }),
        },
    );
