import { InlineKeyboard } from "grammy";

// ============================================================================
// POSTGRESQL DATABASE TYPES
// ============================================================================

export type PgReminderStatus = "pending" | "sent" | "completed" | "cancelled" | "failed";

export type PgReminderRecord = {
    id: string;
    item_id: string;
    remind_at: Date;
    recurrence: any;
    status: PgReminderStatus;
    sent_at: Date | null;
    created_at: Date;
    failure_reason: string | null;
};

// ============================================================================
// REDIS CACHE TYPES
// ============================================================================

export type RedisReminderStatus =
    | "scheduled"
    | "processing"
    | "completed"
    | "failed"
    | "cancelled";

export type RedisReminderRecord = {
    id: string;
    chatId: string;
    userId: string;
    title: string;
    remindAt: string;
    status: RedisReminderStatus;
    attempts: string;
    createdAt: string;
    updatedAt: string;
    processingStartedAt?: string;
    completedAt?: string;
    failedAt?: string;
    failureReason?: string;
};

// ============================================================================
// APP DTOs & INTERNAL TYPES
// ============================================================================

/** 
 * The unified reminder record used throughout the application layer.
 * Currently, it perfectly maps to the Redis representation since Redis acts as the primary app cache.
 */
export type ReminderRecord = RedisReminderRecord;

/** App-level reminder status */
export type ReminderStatus = RedisReminderStatus;

export type CreateReminderInput = {
    chatId: number;
    userId: number;
    title: string;
    remindAt: Date;
};

// ============================================================================
// TELEGRAM INTERACTION TYPES
// ============================================================================

export type ReminderPhase = "menu" | "title" | "date" | "time" | "confirm";

export type ReminderInteractionPhase = {
    id: ReminderPhase;
    text: string;
    menu?: InlineKeyboard;
};

export type ReminderDraft = {
    title?: string;
    date?: Date;
    remindAt?: Date;
};

export type ReminderCallBackQuery =
    | "reminder:new"
    | "reminder:all"
    | "reminder:back"
    | "reminder:cancel"
    | "reminder:date:today"
    | "reminder:date:tomorrow"
    | "reminder:date:custom"
    | "reminder:confirm";
