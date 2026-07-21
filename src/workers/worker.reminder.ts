import { Worker } from "bullmq";
import { Bot } from "grammy";
import dotenv from "dotenv";
import { connectRedis } from "../lib/redis";
import { pool } from "../lib/postgres";
import { ReminderService } from "../services/service.reminder"
import { escapeHtml } from "../utils/utils.reminder";

dotenv.config();

const REMINDERS_QUEUE_NAME = "reminders";

async function main() {
    const bot = new Bot(process.env.BOT_TOKEN!);

    const worker = new Worker(
        REMINDERS_QUEUE_NAME,
        async (job) => {
            const { reminderId } = job.data as { reminderId: string };
            const client = await connectRedis();
            const now = new Date().toISOString();

            // Only update execution timestamps in Redis
            await client.hSet(getReminderKey(reminderId), {
                status: "processing",
                processingStartedAt: now,
                updatedAt: now,
            });

            const reminder = await ReminderService.getReminder(reminderId);

            if (!reminder) {
                return;
            }

            await bot.api.sendMessage(
                Number(reminder.chatId),
                `🔔 <b>Reminder</b>\n\n${escapeHtml(reminder.title)}`,
                { parse_mode: "HTML" },
            );
        },
        {
            connection: {
                host:
                    process.env.REDIS_SERVER_URL
                        ? new URL(process.env.REDIS_SERVER_URL).hostname
                        : "127.0.0.1",
                port: process.env.REDIS_SERVER_URL
                    ? Number(new URL(process.env.REDIS_SERVER_URL).port) || 6379
                    : 6379,
            },
            concurrency: 5,
            lockDuration: 60_000,
            stalledInterval: 30_000,
        },
    );

    worker.on("completed", async (job) => {
        const { reminderId } = job.data as { reminderId: string };
        const client = await connectRedis();
        const now = new Date().toISOString();

        // Update Postgres
        await pool.query(`UPDATE reminders SET status = 'completed', sent_at = now() WHERE id = $1`, [reminderId]);

        // Update Redis cache
        await client.hSet(getReminderKey(reminderId), {
            status: "completed",
            completedAt: now,
            updatedAt: now,
        });
    });

    worker.on("failed", async (job, error) => {
        if (!job) return;

        const { reminderId } = job.data as { reminderId: string };
        const client = await connectRedis();
        const now = new Date().toISOString();

        if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
            // Final failure: Update Postgres
            await pool.query(`UPDATE reminders SET status = 'failed', failure_reason = $1 WHERE id = $2`, [error.message, reminderId]);

            await client.hSet(getReminderKey(reminderId), {
                status: "failed",
                failedAt: now,
                failureReason: error.message,
                updatedAt: now,
            });
        } else {
            // Transient failure: Only update Redis
            await client.hSet(getReminderKey(reminderId), {
                status: "scheduled",
                failureReason: error.message,
                updatedAt: now,
            });
        }
    });

    process.once("SIGINT", () => worker.close());
    process.once("SIGTERM", () => worker.close());
}

function getReminderKey(id: string) {
    return `reminder:${id}`;
}

main().catch((error) => {
    console.error("Reminder worker failed:", error);
    process.exit(1);
});