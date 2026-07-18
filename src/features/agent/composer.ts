import { Composer } from "grammy";

const agentComposer = new Composer();

agentComposer.command("agent", async (ctx) => {
    const text = ctx.match;
    console.log("Reached to agent");
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

    await ctx.reply(
        "\u{1F916} <b>Agent</b>\n\nReceived your prompt:\n<code>" +
            escapeHtml(text) +
            "</code>",
        { parse_mode: "HTML" },
    );
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
