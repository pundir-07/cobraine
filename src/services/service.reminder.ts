import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import { connectRedis } from "../lib/redis";
import { CreateReminderInput, ReminderRecord } from "../types/types.reminder";
import { parseDate, parseTime } from "../utils/utils.reminder";

/**
 * Service for managing reminders.
 * Handles creation, retrieval, listing, and cancellation of reminders,
 * as well as scheduling them in the Redis queue.
 */
export class ReminderService {
    private static readonly REMINDER_KEY_PREFIX = "reminder:";
    private static readonly REMINDERS_QUEUE_NAME = "reminders";

    private static readonly remindersQueue = new Queue(
        ReminderService.REMINDERS_QUEUE_NAME,
        {
            connection: {
                host: process.env.REDIS_SERVER_URL
                    ? new URL(process.env.REDIS_SERVER_URL).hostname
                    : "127.0.0.1",
                port: process.env.REDIS_SERVER_URL
                    ? Number(new URL(process.env.REDIS_SERVER_URL).port) || 6379
                    : 6379,
            },
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 10_000,
                },
                removeOnComplete: {
                    count: 100,
                },
                removeOnFail: {
                    age: 24 * 3600,
                },
            },
        },
    );

    /**
     * Creates a new reminder and schedules it in the queue.
     * Stores the reminder in Redis hash and adds user/chat index sets.
     *
     * @param input - The reminder details (chatId, userId, title, remindAt)
     * @returns The created ReminderRecord
     */
    static async createReminder(input: CreateReminderInput): Promise<ReminderRecord | null> {
        const redis = await connectRedis();
        const id = randomUUID();
        const now = new Date().toISOString();
        const reminderKey = ReminderService.getReminderKey(id);

        await redis
            .multi()
            .hSet(reminderKey, {
                id,
                chatId: String(input.chatId),
                userId: String(input.userId),
                title: input.title,
                remindAt: input.remindAt.toISOString(),
                status: "scheduled",
                attempts: "0",
                createdAt: now,
                updatedAt: now,
            })
            .sAdd(ReminderService.getUserRemindersKey(input.userId), id)
            .sAdd(ReminderService.getChatRemindersKey(input.chatId), id)
            .exec();

        await ReminderService.remindersQueue.add(
            "send-reminder",
            { reminderId: id },
            {
                jobId: id,
                delay: Math.max(0, input.remindAt.getTime() - Date.now()),
            },
        );

        return ReminderService.getReminder(id);
    }

    /**
     * Creates a reminder from string-based date/time inputs.
     * This is the single entry point for the LLM tool — it reuses the same
     * parseDate/parseTime utilities as the interactive /reminder command.
     *
     * @param input - Object containing chatId, userId, title, date string, and time string
     * @returns A result object with either a success message and reminder, or an error message
     */
    static async createReminderFromStrings(
        input: {
            chatId: number;
            userId: number;
            title: string;
            date: string;
            time: string;
        },
    ): Promise<{ ok: true; reminder: ReminderRecord; display: string } | { ok: false; error: string }> {
        const { chatId, userId, title, date: dateStr, time: timeStr } = input;

        if (!title || !dateStr || !timeStr) {
            return { ok: false, error: "Missing required fields: title, date, and time are all needed." };
        }

        const date = parseDate(dateStr);

        if (!date) {
            return {
                ok: false,
                error: `Could not parse date "${dateStr}". Try formats like 25/12, 25/12/2026, or 25 Dec.`,
            };
        }

        const remindAt = parseTime(timeStr, date);
        console.log("Inferred time:", remindAt);

        if (!remindAt) {
            return {
                ok: false,
                error: `Could not parse time "${timeStr}". Use formats like 9am, 9:30pm, or 21:30.`,
            };
        }

        if (remindAt <= new Date()) {
            return { ok: false, error: "That time has already passed. Please pick a future time." };
        }

        try {
            const reminder = await ReminderService.createReminder({ chatId, userId, title, remindAt });

            if (!reminder) {
                return {
                    ok: true,
                    reminder: null as unknown as ReminderRecord,
                    display: "The reminder was created but I couldn't retrieve the details. It should still fire at the right time.",
                };
            }

            const display = [
                `Reminder set: "${title}"`,
                `When: ${remindAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} at ${remindAt.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}`,
            ].join("\n");
            console.log("Reminder set", reminder);
            return { ok: true, reminder, display };
        } catch (error) {
            return {
                ok: false,
                error: `Failed to create reminder: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
        }
    }

    /**
     * Lists all reminders for a given user, sorted by remindAt time.
     *
     * @param userId - The Telegram user ID
     * @returns Array of ReminderRecord objects, sorted by scheduled time
     */
    static async listUserReminders(userId: number): Promise<ReminderRecord[]> {
        const redis = await connectRedis();
        const ids = await redis.sMembers(ReminderService.getUserRemindersKey(userId));
        const reminders = await Promise.all(ids.map((id) => ReminderService.getReminder(id)));

        return reminders
            .filter((reminder): reminder is ReminderRecord => reminder !== null)
            .sort(
                (left, right) =>
                    new Date(left.remindAt).getTime() -
                    new Date(right.remindAt).getTime(),
            );
    }

    /** 
     * Retrieves a single reminder by its ID.
     *
     * @param id - The unique reminder ID
     * @returns The ReminderRecord if found, null otherwise
     */
    static async getReminder(id: string): Promise<ReminderRecord | null> {
        const redis = await connectRedis();
        const reminder = await redis.hGetAll(ReminderService.getReminderKey(id));

        if (!reminder.id) {
            return null;
        }

        return reminder as ReminderRecord;
    }

    /**
     * Cancels a scheduled reminder.
     * Updates the status to "cancelled" in Redis and removes the job from the queue.
     *
     * @param id - The unique reminder ID to cancel
     */
    static async cancelReminder(id: string): Promise<void> {
        const redis = await connectRedis();
        const now = new Date().toISOString();

        await Promise.all([
            redis
                .multi()
                .hSet(ReminderService.getReminderKey(id), {
                    status: "cancelled",
                    updatedAt: now,
                })
                .exec(),
            ReminderService.remindersQueue.remove(id),
        ]);
    }

    private static getReminderKey(id: string): string {
        return `${ReminderService.REMINDER_KEY_PREFIX}${id}`;
    }

    private static getUserRemindersKey(userId: number): string {
        return `user:${userId}:reminders`;
    }

    private static getChatRemindersKey(chatId: number): string {
        return `chat:${chatId}:reminders`;
    }
}