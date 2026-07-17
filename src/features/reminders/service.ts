import { randomUUID } from "node:crypto";
import { connectRedis } from "../../lib/redis";
import { CreateReminderInput, ReminderRecord, ReminderStatus } from "./types";

const REMINDER_KEY_PREFIX = "reminder:";
const DUE_REMINDERS_KEY = "reminders:due";
const PROCESSING_REMINDERS_KEY = "reminders:processing";
const MAX_ATTEMPTS = 3;
const PROCESSING_TIMEOUT_MS = 60_000;

const CLAIM_DUE_REMINDER_SCRIPT = `
local dueKey = KEYS[1]
local processingKey = KEYS[2]
local now = ARGV[1]
local processingTimeout = ARGV[2]
local reminderKeyPrefix = ARGV[3]
local updatedAt = ARGV[4]

local dueIds = redis.call("ZRANGEBYSCORE", dueKey, 0, now, "LIMIT", 0, 1)

if #dueIds == 0 then
    return nil
end

local reminderId = dueIds[1]
local removed = redis.call("ZREM", dueKey, reminderId)

if removed ~= 1 then
    return nil
end

redis.call("ZADD", processingKey, processingTimeout, reminderId)
redis.call("HSET", reminderKeyPrefix .. reminderId,
    "status", "processing",
    "processingStartedAt", updatedAt,
    "updatedAt", updatedAt
)

return reminderId
`;

const RECOVER_STALE_REMINDER_SCRIPT = `
local processingKey = KEYS[1]
local dueKey = KEYS[2]
local now = ARGV[1]
local reminderKeyPrefix = ARGV[2]
local updatedAt = ARGV[3]

local staleIds = redis.call("ZRANGEBYSCORE", processingKey, 0, now, "LIMIT", 0, 1)

if #staleIds == 0 then
    return nil
end

local reminderId = staleIds[1]
local removed = redis.call("ZREM", processingKey, reminderId)

if removed ~= 1 then
    return nil
end

redis.call("ZADD", dueKey, now, reminderId)
redis.call("HSET", reminderKeyPrefix .. reminderId,
    "status", "scheduled",
    "updatedAt", updatedAt
)

return reminderId
`;

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
        .zAdd(DUE_REMINDERS_KEY, {
            score: input.remindAt.getTime(),
            value: id,
        })
        .exec();

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

export async function claimDueReminder() {
    const redis = await connectRedis();
    const now = Date.now();
    const updatedAt = new Date().toISOString();
    const reminderId = await redis.eval(CLAIM_DUE_REMINDER_SCRIPT, {
        keys: [DUE_REMINDERS_KEY, PROCESSING_REMINDERS_KEY],
        arguments: [
            String(now),
            String(now + PROCESSING_TIMEOUT_MS),
            REMINDER_KEY_PREFIX,
            updatedAt,
        ],
    });

    return typeof reminderId === "string" ? reminderId : null;
}

export async function recoverOneStaleReminder() {
    const redis = await connectRedis();
    const now = Date.now();
    const reminderId = await redis.eval(RECOVER_STALE_REMINDER_SCRIPT, {
        keys: [PROCESSING_REMINDERS_KEY, DUE_REMINDERS_KEY],
        arguments: [
            String(now),
            REMINDER_KEY_PREFIX,
            new Date().toISOString(),
        ],
    });

    return typeof reminderId === "string" ? reminderId : null;
}

export async function completeReminder(id: string) {
    const redis = await connectRedis();
    const now = new Date().toISOString();

    await redis
        .multi()
        .zRem(PROCESSING_REMINDERS_KEY, id)
        .hSet(getReminderKey(id), {
            status: "completed",
            completedAt: now,
            updatedAt: now,
        })
        .exec();
}

export async function failReminder(id: string, error: unknown) {
    const redis = await connectRedis();
    const now = new Date().toISOString();
    const attempts = await redis.hIncrBy(getReminderKey(id), "attempts", 1);

    await redis.zRem(PROCESSING_REMINDERS_KEY, id);

    if (attempts <= MAX_ATTEMPTS) {
        const retryAt = Date.now() + getRetryDelayMs(attempts);

        await redis
            .multi()
            .zAdd(DUE_REMINDERS_KEY, {
                score: retryAt,
                value: id,
            })
            .hSet(getReminderKey(id), {
                status: "scheduled",
                updatedAt: now,
                failureReason: getErrorMessage(error),
            })
            .exec();

        return;
    }

    await setReminderStatus(id, "failed", {
        failedAt: now,
        failureReason: getErrorMessage(error),
    });
}

export async function cancelReminder(id: string) {
    const redis = await connectRedis();
    const now = new Date().toISOString();

    await redis
        .multi()
        .zRem(DUE_REMINDERS_KEY, id)
        .zRem(PROCESSING_REMINDERS_KEY, id)
        .hSet(getReminderKey(id), {
            status: "cancelled",
            updatedAt: now,
        })
        .exec();
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

function getRetryDelayMs(attempts: number) {
    if (attempts === 1) return 10_000;
    if (attempts === 2) return 60_000;

    return 5 * 60_000;
}

async function setReminderStatus(
    id: string,
    status: ReminderStatus,
    fields: Record<string, string> = {},
) {
    const redis = await connectRedis();

    await redis.hSet(getReminderKey(id), {
        status,
        updatedAt: new Date().toISOString(),
        ...fields,
    });
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
