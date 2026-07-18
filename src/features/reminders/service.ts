import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import { connectRedis } from "../../lib/redis";
import { CreateReminderInput, ReminderRecord } from "./types";

const REMINDER_KEY_PREFIX = "reminder:";
const REMINDERS_QUEUE_NAME = "reminders";

const remindersQueue = new Queue(REMINDERS_QUEUE_NAME, {
    connection: {
        host:
            process.env.REDIS_SERVER_URL
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
});

export async function createReminder(input: CreateReminderInput) {
    const redis = await connectRedis();
    const id = randomUUID();
    const now = new Date().toISOString();
    const reminderKey = getReminderKey(id);

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
        .sAdd(getUserRemindersKey(input.userId), id)
        .sAdd(getChatRemindersKey(input.chatId), id)
        .exec();

    await remindersQueue.add(
        "send-reminder",
        { reminderId: id },
        {
            jobId: id,
            delay: Math.max(0, input.remindAt.getTime() - Date.now()),
        },
    );

    return getReminder(id);
}

export async function listUserReminders(userId: number) {
    const redis = await connectRedis();
    const ids = await redis.sMembers(getUserRemindersKey(userId));
    const reminders = await Promise.all(ids.map((id) => getReminder(id)));

    return reminders
        .filter((reminder): reminder is ReminderRecord => reminder !== null)
        .sort(
            (left, right) =>
                new Date(left.remindAt).getTime() -
                new Date(right.remindAt).getTime(),
        );
}

export async function getReminder(id: string) {
    const redis = await connectRedis();
    const reminder = await redis.hGetAll(getReminderKey(id));

    if (!reminder.id) {
        return null;
    }

    return reminder as ReminderRecord;
}

export async function cancelReminder(id: string) {
    const redis = await connectRedis();
    const now = new Date().toISOString();

    await Promise.all([
        redis
            .multi()
            .hSet(getReminderKey(id), {
                status: "cancelled",
                updatedAt: now,
            })
            .exec(),
        remindersQueue.remove(id),
    ]);
}

function getReminderKey(id: string) {
    return `${REMINDER_KEY_PREFIX}${id}`;
}

function getUserRemindersKey(userId: number) {
    return `user:${userId}:reminders`;
}

function getChatRemindersKey(chatId: number) {
    return `chat:${chatId}:reminders`;
}