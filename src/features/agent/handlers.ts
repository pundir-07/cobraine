import { Context, InlineKeyboard } from "grammy";
import { Interaction } from "../../types";
import { openRouter } from "../../lib/llm";
import { AgentCallbackQuery, AgentData } from "./types";
import { buildChatContext, ensureUser, saveMessage } from "./service";

export class AgentInteraction extends Interaction {
  data: AgentData = { chatId: 0, uiMessageId: 0 };
  private finished = false;

  constructor() {
    super("agent");
  }

  async initialise(ctx: Context) {
    this.finished = false;

    const text =
      (ctx.match as string) ?? ctx.message?.text;
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    const username = ctx.from?.username;
    const firstName = ctx.from?.first_name;
    const lastName = ctx.from?.last_name;

    if (!userId || !chatId) return;

    await ensureUser(userId, username, firstName, lastName);

    await this.respondToPrompt(ctx, text, userId, chatId);
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

  private async handleCallbackQuery(ctx: Context) {
    await ctx.answerCallbackQuery();

    const callbackQuery = ctx.update.callback_query?.data as AgentCallbackQuery;

    if (callbackQuery === "agent:close") {
      await this.close(ctx);
    }
  }

  private async handleTextMessage(ctx: Context) {
    const message = ctx.update.message;
    const text = message?.text?.trim();
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;

    if (!text || !userId || !chatId) return;

    await this.respondToPrompt(ctx, text, userId, chatId);
  }

  private async respondToPrompt(
    ctx: Context,
    prompt: string,
    userId: number,
    chatId: number,
  ) {
    const thinkingMsg = await ctx.reply(
      "\u{1F916} <b>Agent</b> is thinking...",
      { parse_mode: "HTML" },
    );

    try {
      await saveMessage(userId, chatId, "user", prompt);

      const messages = await buildChatContext(userId, chatId, prompt);

      const response = await openRouter.chat(messages);

      await saveMessage(userId, chatId, "assistant", response);

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