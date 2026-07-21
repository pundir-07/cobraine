import { Context, InlineKeyboard } from "grammy";
import { Interaction } from "../types";
import {ReminderService} from "../services/service.reminder";
import {
    ReminderCallBackQuery,
    ReminderDraft,
    ReminderInteractionPhase,
    ReminderPhase,
    ReminderRecord,
} from "../types/types.reminder";
import {
    escapeHtml,
    formatReminderDate,
    formatReminderDateTime,
    formatReminderTime,
    getToday,
    getTomorrow,
    parseDate,
    parseTime,
} from "../utils/utils.reminder";

export class ReminderInteraction extends Interaction {
    data: ReminderDraft = {};
    private currentPhase: ReminderPhase = "menu";
    private finished = false;
    private phaseHistory: ReminderPhase[] = [];
    private chatId: number | null = null;
    private uiMessageId: number | null = null;
    private messagePrefix = "";

    constructor() {
        super("reminder");
    }

    async initialise(ctx: Context) {
        this.data = {};
        this.currentPhase = "menu";
        this.finished = false;
        this.phaseHistory = [];
        this.messagePrefix = "";

        const phase = getReminderPhase("menu");
        const response = await ctx.reply(phase.text, {
            reply_markup: phase.menu,
            parse_mode: "HTML",
        });

        this.chatId = response.chat.id;
        this.uiMessageId = response.message_id;
    }

    async handle(ctx: Context) {
        if (this.finished) return;

        if ("callback_query" in ctx.update) {
            await this.handleCallbackQuery(ctx);
            return;
        }

        if ("message" in ctx.update) {
            await this.handleTextMessage(ctx);
        }
    }

    isFinished() {
        return this.finished;
    }

    private async handleTextMessage(ctx: Context) {
        const message = ctx.update.message;
        const text = message?.text?.trim();

        if (!text) return;

        switch (this.currentPhase) {
            case "title":
                this.data.title = text;
                this.goToPhase("date");
                await this.deleteUserMessage(ctx);
                await this.replyWithPhase(ctx);
                return;
            case "date":
                await this.handleCustomDate(ctx, text);
                return;
            case "time":
                await this.handleTime(ctx, text);
                return;
            default:
                return;
        }
    }

    private async handleCallbackQuery(ctx: Context) {
        await ctx.answerCallbackQuery();

        const callbackQuery = ctx.update.callback_query
            ?.data as ReminderCallBackQuery;

        switch (callbackQuery) {
            case "reminder:new":
                this.data = {};
                this.phaseHistory = [];
                this.messagePrefix = "";
                this.goToPhase("title");
                await this.replyWithPhase(ctx);
                return;
            case "reminder:all":
                await this.replyWithReminderList(ctx);
                return;
            case "reminder:cancel":
                await this.cancel(ctx);
                return;
            case "reminder:back":
                this.goBack();
                await this.replyWithPhase(ctx);
                return;
            case "reminder:date:today":
                this.data.date = getToday();
                this.goToPhase("time");
                await this.replyWithPhase(ctx);
                return;
            case "reminder:date:tomorrow":
                this.data.date = getTomorrow();
                this.goToPhase("time");
                await this.replyWithPhase(ctx);
                return;
            case "reminder:date:custom":
                await this.replyWithPhase(
                    ctx,
                    "Type a date like <code>25/12</code>, <code>25/12/2026</code>, or <code>25 Dec</code>.",
                );
                return;
            case "reminder:confirm":
                await this.confirmReminder(ctx);
                return;
        }
    }

    private async handleCustomDate(ctx: Context, text: string) {
        const date = parseDate(text);

        await this.deleteUserMessage(ctx);

        if (!date) {
            await this.replyWithPhase(
                ctx,
                "I couldn't understand that date. Try <code>25/12</code>, <code>25/12/2026</code>, or <code>25 Dec</code>.",
            );
            return;
        }

        this.data.date = date;
        this.goToPhase("time");
        await this.replyWithPhase(ctx);
    }

    private async handleTime(ctx: Context, text: string) {
        if (!this.data.date) {
            this.goToPhase("date");
            await this.replyWithPhase(ctx);
            return;
        }

        const remindAt = parseTime(text, this.data.date);

        await this.deleteUserMessage(ctx);

        if (!remindAt) {
            await this.replyWithPhase(
                ctx,
                "I couldn't understand that time. Try <code>9am</code>, <code>9:30pm</code>, or <code>21:30</code>.",
            );
            return;
        }

        if (remindAt <= new Date()) {
            await this.replyWithPhase(
                ctx,
                "That time has already passed. Pick a future time.",
            );
            return;
        }

        this.data.remindAt = remindAt;
        this.goToPhase("confirm");
        await this.replyWithPhase(ctx);
    }

    private async confirmReminder(ctx: Context) {
        const userId = ctx.from?.id;

        if (!this.chatId || !userId || !this.data.title || !this.data.remindAt) {
            await this.replyWithPhase(
                ctx,
                "The reminder details are incomplete. Please start again.",
            );
            return;
        }

        const reminder = await ReminderService.createReminder({
            chatId: this.chatId,
            userId,
            title: this.data.title,
            remindAt: this.data.remindAt,
        });

        this.finished = true;

        await this.editUiMessage(
            ctx,
            `✅ Reminder scheduled.\n\n${formatReminderSummary(reminder)}`,
        );
    }

    private async replyWithReminderList(ctx: Context) {
        const userId = ctx.from?.id;

        if (!userId) return;

        const reminders = await ReminderService.listUserReminders(userId);
        const activeReminders = reminders.filter(
            (reminder) =>
                reminder.status === "scheduled" ||
                reminder.status === "processing",
        );

        this.messagePrefix = "";

        await this.editUiMessage(
            ctx,
            activeReminders.length
                ? formatReminderList(activeReminders)
                : "You do not have any scheduled reminders.",
            new InlineKeyboard()
                .text("Set a new Reminder", "reminder:new")
                .row()
                .text("❌ Close", "reminder:cancel"),
        );
    }

    private async cancel(ctx: Context) {
        this.finished = true;

        if (this.chatId && this.uiMessageId) {
            try {
                await ctx.api.deleteMessage(this.chatId, this.uiMessageId);
            } catch {
                // The message may already be gone or no longer deletable.
            }
        }
    }

    private goToPhase(phase: ReminderPhase) {
        if (this.currentPhase !== phase) {
            this.phaseHistory.push(this.currentPhase);
        }

        this.currentPhase = phase;
        this.messagePrefix = "";
    }

    private goBack() {
        this.currentPhase = this.phaseHistory.pop() ?? "menu";
        this.messagePrefix = "";
    }

    private async replyWithPhase(ctx: Context, prefix = "") {
        this.messagePrefix = prefix;
        const phase = getReminderPhase(this.currentPhase);
        const parts = [
            this.messagePrefix,
            getDraftSummary(this.data),
            phase.text,
        ].filter(Boolean);

        await this.editUiMessage(ctx, parts.join("\n\n"), phase.menu);
    }

    private async editUiMessage(
        ctx: Context,
        text: string,
        menu?: InlineKeyboard,
    ) {
        if (!this.chatId || !this.uiMessageId) return;

        await ctx.api.editMessageText(this.chatId, this.uiMessageId, text, {
            reply_markup: menu,
            parse_mode: "HTML",
        });
    }

    private async deleteUserMessage(ctx: Context) {
        try {
            await ctx.deleteMessage();
        } catch {
            // Telegram may reject deletes for older or unavailable messages.
        }
    }
}

function getReminderPhase(phase: ReminderPhase): ReminderInteractionPhase {
    const phases: Record<ReminderPhase, ReminderInteractionPhase> = {
        menu: {
            id: "menu",
            text: "🔔 <b>Reminders</b>",
            menu: new InlineKeyboard()
                .text("Set a new Reminder", "reminder:new")
                .text("Show all reminders", "reminder:all")
                .row()
                .text("❌ Close", "reminder:cancel"),
        },
        title: {
            id: "title",
            text: "📝 What would you like me to remind you about?\n\nReply with the reminder text.",
            menu: getNavigationMenu(),
        },
        date: {
            id: "date",
            text: "📅 When should I remind you?\n\nChoose a date or type one yourself.",
            menu: new InlineKeyboard()
                .text("Today", "reminder:date:today")
                .row()
                .text("Tomorrow", "reminder:date:tomorrow")
                .row()
                .text("📆 Custom Date", "reminder:date:custom")
                .row()
                .text("⬅️ Back", "reminder:back")
                .text("❌ Cancel", "reminder:cancel"),
        },
        time: {
            id: "time",
            text: "🕒 What time should I remind you?\n\nReply with a time like <code>9am</code>, <code>9:30pm</code>, or <code>21:30</code>.",
            menu: getNavigationMenu(),
        },
        confirm: {
            id: "confirm",
            text: "Does this look right?",
            menu: new InlineKeyboard()
                .text("✅ Confirm", "reminder:confirm")
                .row()
                .text("⬅️ Back", "reminder:back")
                .text("❌ Cancel", "reminder:cancel"),
        },
    };

    return phases[phase];
}

function getNavigationMenu() {
    return new InlineKeyboard()
        .text("⬅️ Back", "reminder:back")
        .text("❌ Cancel", "reminder:cancel");
}

function getDraftSummary(draft: ReminderDraft) {
    const lines = ["<b>Setting up your reminder</b>"];

    if (draft.title) {
        lines.push(`<b>Title</b>: ${escapeHtml(draft.title)}`);
    }

    if (draft.date) {
        lines.push(`<b>Date</b>: ${escapeHtml(formatReminderDate(draft.date))}`);
    }

    if (draft.remindAt) {
        lines.push(
            `<b>Time</b>: ${escapeHtml(formatReminderTime(draft.remindAt))}`,
        );
    }

    return lines.length > 1 ? lines.join("\n") : "";
}

function formatReminderSummary(reminder: ReminderRecord | null) {
    if (!reminder) {
        return "The reminder was saved.";
    }

    return [
        `<b>Title</b>: ${escapeHtml(reminder.title)}`,
        `<b>When</b>: ${escapeHtml(formatReminderDateTime(new Date(reminder.remindAt)))}`,
    ].join("\n");
}

function formatReminderList(reminders: ReminderRecord[]) {
    const lines = ["<b>Your scheduled reminders</b>"];

    for (const reminder of reminders.slice(0, 10)) {
        lines.push(
            `• ${escapeHtml(reminder.title)} — ${escapeHtml(
                formatReminderDateTime(new Date(reminder.remindAt)),
            )}`,
        );
    }

    if (reminders.length > 10) {
        lines.push(`\nShowing 10 of ${reminders.length} reminders.`);
    }

    return lines.join("\n");
}
