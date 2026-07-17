import { Context, InlineKeyboard } from "grammy";
import { ParseMode } from "grammy/types";

export type ReminderInteractionPhase = {
    title: string;
    text: string;
    menu?: InlineKeyboard;
    parseMode?: ParseMode;
    next?: ReminderInteractionPhase;
    prev?: ReminderInteractionPhase;
};

export type Reminder = {
    title: string;
    time: string;
    date: string;
    repeat: string;
};

export type ReminderCallBackQuery =
    | "reminder:new"
    | "reminder:all"
    | "reminder:back"
    | "reminder:cancel"
    | "reminder:date:today"
    | "reminder:date:tomorrow"
    | "reminder:date:custom"
    | "reminder:time:now"
    // TODO implement time repeat callbacks
    | "reminder:confirm"
    | "reminder:repeat:day"
    | "reminder:repeat:hour"
    | "reminder:repeat:week"
    | "reminder:repeat:month"
    | "reminder:repeat:year";

