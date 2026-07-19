import { Context, InlineKeyboard } from "grammy";
import { Interaction } from "../../types";
import { openRouter } from "../../lib/llm";
import { AgentCallbackQuery, AgentData } from "./types";

export class AgentInteraction extends Interaction {
  data: AgentData = { chatId: 0, uiMessageId: 0 };
  private finished = false;

  constructor() {
    super("agent");
  }

  async initialise(ctx: Context) {
    this.finished = false;

    const text = ctx.match as string | undefined;

    if (!text) {
      const response = await ctx.reply(
        "\u{1F916} <b>Agent</b>\n\n" +
          "Send me a prompt and I'll answer it using AI.\n\n" +
          "Usage: <code>/agent " +
          esc("lt") +
          "your prompt" +
          esc("gt") +
          "</code>\n\n" +
          "Or just keep typing messages and I'll respond to each one.\n" +
          "Tap <b>Close</b> below to end the session.",
        {
          reply_markup: new InlineKeyboard().text("\u{274C} Close", "agent:close"),
          parse_mode: "HTML",
        },
      );

      this.data = { chatId: response.chat.id, uiMessageId: response.message_id };
      return;
    }

    await this.respondToPrompt(ctx, text);
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

    if (!text) return;

    // await this.deleteUserMessage(ctx);
    await this.respondToPrompt(ctx, text);
  }

  private async respondToPrompt(ctx: Context, prompt: string) {
    const thinkingMsg = await ctx.reply(
      "\u{1F916} <b>Agent</b> is thinking...",
      { parse_mode: "HTML" },
    );

    try {
      const response = await openRouter.chat([
        {
          role: "system",
          content:
            "You are a helpful assistant. Answer the user's query concisely and accurately.",
        },
        { role: "user", content: prompt },
      ]);

      await ctx.api.editMessageText(
        thinkingMsg.chat.id,
        thinkingMsg.message_id,
        "\u{1F916} <b>Agent</b>\n\n" + escapeHtml(response),
        {
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard().text(
            "\u{274C} Close",
            "agent:close",
          ),
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