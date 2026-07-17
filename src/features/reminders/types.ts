import { InlineKeyboard } from "grammy";

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

export type ReminderStatus =
    | "scheduled"
    | "processing"
    | "completed"
    | "failed"
    | "cancelled";

export type ReminderRecord = {
    id: string;
    chatId: string;
    userId: string;
    title: string;
    remindAt: string;
    status: ReminderStatus;
    attempts: string;
    createdAt: string;
    updatedAt: string;
    processingStartedAt?: string;
    completedAt?: string;
    failedAt?: string;
    failureReason?: string;
};

export type CreateReminderInput = {
    chatId: number;
    userId: number;
    title: string;
    remindAt: Date;
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
