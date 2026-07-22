import { Context, InlineKeyboard } from "grammy";
import { Interaction } from "../types";
import { AgentCallbackQuery, AgentData } from "../types/types.agent";
import { MessageService } from "../services/service.message";
import { UserService } from "../services/service.user";
import { OpenRouterAgentService } from "../services/service.agent";
import { BotUser } from "@/types/types.user";
import { User } from "../models/model.user";

export class AgentInteraction extends Interaction {
    data: AgentData = { chatId: 0, uiMessageId: 0 };
    private user!: User;
    private finished = false;

    constructor() {
        super("agent");
    }

    async initialise(ctx: Context) {
        this.finished = false;

        const text =
            (ctx.match as string) ?? ctx.message?.text;
        const userTelegramId = ctx.from?.id;
        const chatId = ctx.chat?.id;
        const username = ctx.from?.username;
        const firstName = ctx.from?.first_name;

        if (!userTelegramId || !chatId) return;

        // Upsert returns a Domain User Object
        this.user = await UserService.upsertUser(userTelegramId, username, firstName);

        await this.respondToPrompt(ctx, text, chatId);
    }

    async handle(ctx: Context) {
        if (this.finished) return;

        // Agent handles message and callback query
        const message = ctx.update.message;
        const callbackQuery = ctx.update.callback_query;

        if (message) {
            await this.handleTextMessage(ctx);
        } else if (callbackQuery) {
            await this.handleCallbackQuery(ctx);
        }
    }

    isFinished() {
        return this.finished;
    }

    private async handleCallbackQuery(ctx: Context) {
        const callbackQuery = ctx.update.callback_query;
        const data = callbackQuery?.data as AgentCallbackQuery;

        if (!data) return;
        switch (data) {
            case "agent:close":
                await this.close(ctx);
                break;
            default:
                break;
        }

        await ctx.answerCallbackQuery();
    }

    private async handleTextMessage(ctx: Context) {
        const message = ctx.update.message;
        const text = message?.text?.trim();
        const chatId = ctx.chat?.id;

        if (!text || !this.user || !chatId) return;

        await this.respondToPrompt(ctx, text, chatId);
    }

    private async respondToPrompt(
        ctx: Context,
        prompt: string,
        chatId: number,
    ) {
        const thinkingMsg = await ctx.reply(
            "\u{1F916} <b>Agent</b> is thinking...",
            { parse_mode: "HTML" },
        );

        try {
            await MessageService.saveMessage(this.user.internalId, chatId, "user", prompt);
            console.log("SENDING PROMPT:", prompt)

            // Pass in Domain user info to OpenRouter!
            const response = await OpenRouterAgentService.continueUserChat(
                this.user.internalId,
                this.user.telegramId,
                chatId,
                prompt,
                // Passing some useful domain information to LLM
                `User Name: ${this.user.fullName}\nLanguage: ${this.user.languageCode}`
            )

            await MessageService.saveMessage(this.user.internalId, chatId, "assistant", response);

            await ctx.api.editMessageText(
                thinkingMsg.chat.id,
                thinkingMsg.message_id,
                "\u{1F916} <b>Agent</b>\n\n" + response,
                {
                    parse_mode: "HTML",
                },
            );
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";

            await ctx.api.editMessageText(
                thinkingMsg.chat.id,
                thinkingMsg.message_id,
                "\u{1F916} <b>Agent</b>\n\n\u{274C} Error: " + escapeHtml(errorMessage),
                {
                    parse_mode: "HTML",
                    reply_markup: new InlineKeyboard().text(
                        "\u{274C} Close",
                        "agent:close",
                    ),
                },
            );
        }
    }

    private async close(ctx: Context) {
        this.finished = true;

        if (this.data.chatId && this.data.uiMessageId) {
            try {
                await ctx.api.deleteMessage(this.data.chatId, this.data.uiMessageId);
            } catch {
                // Message may already be gone.
            }
        }
    }

    private async deleteUserMessage(ctx: Context) {
        try {
            await ctx.deleteMessage();
        } catch {
            // Telegram may reject deletes for older or unavailable messages.
        }
    }
}

function esc(name: string): string {
    return "&" + name + ";";
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, esc("amp"))
        .replace(/</g, esc("lt"))
        .replace(/>/g, esc("gt"));
}