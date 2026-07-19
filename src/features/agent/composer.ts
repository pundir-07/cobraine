import { Composer } from "grammy";
import { openRouter } from "../../lib/llm";

const agentComposer = new Composer();

agentComposer.command("agent", async (ctx) => {
  const text = ctx.match;

  if (!text) {
    await ctx.reply(
      "\u{1F916} <b>Agent Command</b>\n\n" +
        "Usage: <code>/agent " +
        esc("lt") +
        "your prompt" +
        esc("gt") +
        "</code>\n\n" +
        "Example: <code>/agent What is the weather today?</code>",
      { parse_mode: "HTML" },
    );
    return;
  }

  const reply = await ctx.reply("\u{1F916} <b>Agent</b> is thinking...", {
    parse_mode: "HTML",
  });

  try {
    const response = await openRouter.chat([
      {
        role: "system",
        content:
          "You are a helpful assistant. Answer the user's query concisely and accurately.",
      },
      { role: "user", content: text },
    ]);

    await ctx.api.editMessageText(
      ctx.chat!.id,
      reply.message_id,
      "\u{1F916} <b>Agent</b>\n\n" + escapeHtml(response),
      { parse_mode: "HTML" },
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await ctx.api.editMessageText(
      ctx.chat!.id,
      reply.message_id,
      "\u{1F916} <b>Agent</b>\n\n\u{274C} Error: " + escapeHtml(errorMessage),
      { parse_mode: "HTML" },
    );
  }
});

function esc(name: string): string {
  return "&" + name + ";";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, esc("amp"))
    .replace(/</g, esc("lt"))
    .replace(/>/g, esc("gt"));
}

export default agentComposer;