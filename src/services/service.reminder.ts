import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import { connectRedis } from "../lib/redis";
import { pool } from "../lib/postgres";
import { CreateReminderInput, ReminderRecord } from "../types/types.reminder";
import { parseDate, parseTime } from "../utils/utils.reminder";

/**
 * Service for managing reminders.
 * Handles creation, retrieval, listing, and cancellation of reminders,
 * as well as scheduling them in the BullMQ queue.
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
     * Stores the reminder in PostgreSQL, then adds to Redis cache and queue.
     *
     * @param input - The reminder details (chatId, userId, title, remindAt)
     * @returns The created ReminderRecord
     */
    static async createReminder(input: CreateReminderInput): Promise<ReminderRecord | null> {
        const redis = await connectRedis();
        const now = new Date().toISOString();

        // 1. Ensure User exists in PostgreSQL
        const userRes = await pool.query(`
            INSERT INTO users (telegram_id)
            VALUES ($1)
            ON CONFLICT (telegram_id) DO UPDATE SET updated_at = now()
            RETURNING id
        `, [input.userId]);
        const userUuid = userRes.rows[0].id;

        // 2. Create Item in PostgreSQL (store chatId in metadata)
        const itemRes = await pool.query(`
            INSERT INTO items (user_id, type, title, metadata)
            VALUES ($1, 'reminder', $2, $3)
            RETURNING id
        `, [userUuid, input.title, JSON.stringify({ chatId: input.chatId })]);
        const itemId = itemRes.rows[0].id;

        // 3. Create Reminder in PostgreSQL
        const reminderRes = await pool.query(`
            INSERT INTO reminders (item_id, remind_at, status)
            VALUES ($1, $2, 'pending')
            RETURNING id, created_at
        `, [itemId, input.remindAt.toISOString()]);
        const reminderId = reminderRes.rows[0].id;
        const createdAt = new Date(reminderRes.rows[0].created_at).toISOString();
        
        const reminderKey = ReminderService.getReminderKey(reminderId);

        // 4. Update Redis cache
        await redis
            .multi()
            .hSet(reminderKey, {
                id: reminderId,
                chatId: String(input.chatId),
                userId: String(input.userId),
                title: input.title,
                remindAt: input.remindAt.toISOString(),
                status: "scheduled",
                attempts: "0",
                createdAt: createdAt,
                updatedAt: createdAt,
            })
            .sAdd(ReminderService.getUserRemindersKey(input.userId), reminderId)
            .sAdd(ReminderService.getChatRemindersKey(input.chatId), reminderId)
            .exec();

        await ReminderService.remindersQueue.add(
            "send-reminder",
            { reminderId: reminderId },
            {
                jobId: reminderId,
                delay: Math.max(0, input.remindAt.getTime() - Date.now()),
            },
        );

        return ReminderService.getReminder(reminderId);
    }

    /**
     * Creates a reminder from string-based date/time inputs.
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
     * Fetches from Postgres to ensure accuracy, then relies on Redis cache for details.
     */
    static async listUserReminders(userId: number): Promise<ReminderRecord[]> {
        const query = `
            SELECT r.id
            FROM reminders r
            JOIN items i ON r.item_id = i.id
            JOIN users u ON i.user_id = u.id
            WHERE u.telegram_id = $1
            ORDER BY r.remind_at ASC
        `;
        const res = await pool.query(query, [userId]);
        const ids = res.rows.map((row) => row.id);

        const reminders = await Promise.all(ids.map((id) => ReminderService.getReminder(id)));

        return reminders.filter((reminder): reminder is ReminderRecord => reminder !== null);
    }

    /** 
     * Retrieves a single reminder by its ID.
     * Uses Cache-Aside pattern: checks Redis first, then Postgres.
     */
    static async getReminder(id: string): Promise<ReminderRecord | null> {
        const redis = await connectRedis();
        const cachedReminder = await redis.hGetAll(ReminderService.getReminderKey(id));

        if (cachedReminder && cachedReminder.id) {
            return cachedReminder as ReminderRecord;
        }

        // Cache miss: Fetch from PostgreSQL
        const query = `
            SELECT 
                r.id, 
                i.title, 
                i.metadata->>'chatId' as chat_id,
                r.remind_at, 
                r.status, 
                r.created_at, 
                r.sent_at, 
                r.failure_reason,
                u.telegram_id as user_id
            FROM reminders r
            JOIN items i ON r.item_id = i.id
            JOIN users u ON i.user_id = u.id
            WHERE r.id = $1
        `;
        const res = await pool.query(query, [id]);
        if (res.rows.length === 0) {
            return null;
        }

        const row = res.rows[0];
        const record: ReminderRecord = {
            id: row.id,
            chatId: row.chat_id || row.user_id,
            userId: row.user_id,
            title: row.title,
            remindAt: new Date(row.remind_at).toISOString(),
            status: row.status === 'pending' ? 'scheduled' : row.status, 
            attempts: "0",
            createdAt: new Date(row.created_at).toISOString(),
            updatedAt: new Date(row.created_at).toISOString(),
        };
        
        if (row.sent_at) {
            record.completedAt = new Date(row.sent_at).toISOString();
        }
        if (row.failure_reason) {
            record.failureReason = row.failure_reason;
        }

        // Populate Redis cache
        const recordToSave = { ...record };
        // Clean undefined values before saving to Redis hash
        Object.keys(recordToSave).forEach(key => {
            if (recordToSave[key as keyof ReminderRecord] === undefined) {
                delete recordToSave[key as keyof ReminderRecord];
            }
        });

        await redis.hSet(ReminderService.getReminderKey(id), recordToSave);

        return record;
    }

    /**
     * Cancels a scheduled reminder.
     * Updates the status to "cancelled" in Postgres and Redis, and removes the job.
     */
    static async cancelReminder(id: string): Promise<void> {
        const redis = await connectRedis();
        const now = new Date().toISOString();

        await pool.query(`UPDATE reminders SET status = 'cancelled' WHERE id = $1`, [id]);

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