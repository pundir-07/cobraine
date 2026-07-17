import { Context, InlineKeyboard } from "grammy";
import { Interaction } from "../../types";
import {
    Reminder,
    ReminderCallBackQuery,
    ReminderInteractionPhase,
} from "./types";

export class ReminderInteraction extends Interaction {
    private phases
    private currentPhase!: ReminderInteractionPhase;
    private initialised = false;
    private chatID: number | null = null;
    private uiMessageID: number | null = null;
    data: Reminder;
    constructor() {
        super("reminder");
        this.data = {
            title: "",
            time: "",
            repeat: "",
            date: "",
        };
        this.phases=getReminderInteractionPhases()
        return this;
    }
    getPhase(): ReminderInteractionPhase {
        return this.currentPhase;
    }
    async initialise(ctx: Context) {
        this.initialised = true;
        this.currentPhase = this.phases.initial;
        const response = await ctx.reply(this.currentPhase.text, {
            reply_markup: this.currentPhase.menu,
            parse_mode: this.currentPhase.parseMode,
        });
        this.chatID = response.chat.id;
        this.uiMessageID = response.message_id;
    }
    async handle(ctx: Context) {
        if (!this.initialised) return;
        console.log("HANDLING REMINDER");
        if ("callback_query" in ctx.update) {
            this.handleCallBackQuery(ctx);
        } else if ("message" in ctx.update) {
            this.handleTextMessage(ctx);
        }
    }
    private async handleTextMessage(ctx: Context) {
        const msg = ctx.update.message!.text;
        switch (this.currentPhase.title) {
            case "title":
                this.data.title = msg!;
                this.currentPhase = this.phases.date;
                this.currentPhase.prev = this.phases.title;
                await ctx.deleteMessage();
                await this.replyWithPhase(ctx);
        }
    }
    private async handleCallBackQuery(ctx: Context) {
        console.log("Handling callback query: ", ctx);
        const callbackQuery = ctx.update.callback_query!
            .data as ReminderCallBackQuery;
        switch (callbackQuery) {
            case "reminder:new":
                this.currentPhase = this.phases.title;
                this.currentPhase.prev = this.phases.initial;
                this.replyWithPhase(ctx);
                break;
            case "reminder:cancel":
                this.currentPhase = this.phases.idle;
                await ctx.deleteMessage();
                this.initialised = false;
                break;
            case "reminder:back":
                this.currentPhase = this.currentPhase.prev!;
                await this.replyWithPhase(ctx);
                break;
            case "reminder:date:today":
                this.data.date = "today";
                this.currentPhase = this.phases.time;
                this.currentPhase.prev = this.phases.date;
                await this.replyWithPhase(ctx);
                break;
            case "reminder:date:tomorrow":
                this.data = { ...this.data, date: "tomorrow" };
                this.currentPhase = this.phases.time;
                this.currentPhase.prev = this.phases.date;
                await this.replyWithPhase(ctx);
                break;
            case "reminder:time:now":
                this.data = { ...this.data, time: "now" };
                this.currentPhase = this.phases.time;
                await this.replyWithPhase(ctx);
                break;
        }
    }
    private async replyWithPhase(ctx: Context) {
        await ctx.api.editMessageText(
            this.chatID!,
            this.uiMessageID!,
            `${this.data.title && this.getReminderSetupString()}
			${this.currentPhase.text}`,
            {
                reply_markup: this.currentPhase.menu,
                parse_mode: "HTML",
            },
        );
    }
    private getReminderSetupString(): string {
        return `
		Setting up your reminder:
		${this.data.title && `\n<b>Title</b>:${this.data.title}`}${this.data.date && `\n<b>Date</b>:${this.data.date}`}${this.data.time && `\n<b>Time</b>:${this.data.time}`}${this.data.repeat && `\n<b>Repeat</b>:${this.data.repeat}`}
		`;
    }
}

const getReminderInteractionPhases = () => {
    return {
        idle: {
            title: "",
            text: "",
            menu: new InlineKeyboard(),
        },
        initial: {
            title: "initiate",
            text: "🔔 Reminders",
            menu: new InlineKeyboard()
                .text("Set a new Reminder", "reminder:new")
                .text("Show all reminders", "reminder:all")
                .row()
                .text("❌ Cancel", "reminder:cancel"),
        },
        title: {
            title: "title",
            text: `📝 What would you like me to remind you about?

Reply with the reminder text.`,
            menu: new InlineKeyboard()
                .text("⬅️ Back", "reminder:back")
                .text("❌ Cancel", "reminder:cancel"),
        },
        date: {
            title: "date",
            text: `📅 When should I remind you?

Choose a date or type one yourself.`,
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
            title: "time",
            text: "🕒 What time should I remind you?",
            menu: new InlineKeyboard()
                .text("✅ Confirm", "reminder:confirm")
                .row()
                .text("⬅️ Back", "reminder:back")
                .text("❌ Cancel", "reminder:cancel"),
        },
    };
};
