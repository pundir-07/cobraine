import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ReminderService } from '../../services/service.reminder';
import { UserService } from '../../services/service.user';
import { formatDateTimeForUser } from '../../utils/utils.time';

export const setReminderTool = (userId: number, chatId: number) =>
    tool(
        async ({ title, date, time, checkpointId }) => {
            const user = await UserService.getUserByTelegramId(userId);
            const timezone = user?.timezone ?? 'UNSET';

            const result = await ReminderService.createReminderFromStrings({
                chatId,
                userId,
                title,
                date,
                time,
                timezone,
                checkpointId,
            });
            return result.ok ? result.display : result.error;
        },
        {
            name: 'set_reminder',
            description:
                'Create a new reminder for the user. The reminder will fire at the specified time.',
            schema: z.object({
                title: z.string().describe('What the reminder is about'),
                date: z
                    .string()
                    .describe(
                        'Date for the reminder. Use formats like 25/12, 25/12/2026, or 25 Dec.',
                    ),
                time: z
                    .string()
                    .describe(
                        'Time for the reminder in 12h or 24h format (e.g., 9am, 9:30pm, 21:30). Must be in the future.',
                    ),
                checkpointId: z
                    .string()
                    .optional()
                    .describe(
                        'Optional ID of the plan checkpoint this reminder is for. Provide this if creating a reminder for a checkpoint.',
                    ),
            }),
        },
    );

export const listRemindersTool = (userId: number) =>
    tool(
        async () => {
            try {
                const user = await UserService.getUserByTelegramId(userId);
                const timezone = user?.timezone ?? 'UNSET';

                const reminders = await ReminderService.listUserReminders(userId);
                const active = reminders.filter(
                    (r) => r.status === 'scheduled' || r.status === 'processing',
                );

                if (active.length === 0) {
                    return "You don't have any upcoming reminders.";
                }

                const lines = active.map((r, i) => {
                    const when = new Date(r.remindAt);
                    return `${i + 1}. "${r.title}" — ${formatDateTimeForUser(when, timezone)}`;
                });
                return ['Your scheduled reminders:', ...lines].join('\n');
            } catch (error) {
                return `Failed to list reminders: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
        {
            name: 'list_reminders',
            description: 'List all currently scheduled reminders for the user.',
            schema: z.object({}),
        },
    );
