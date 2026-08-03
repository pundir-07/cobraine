import { Composer } from "grammy";

const startComposer = new Composer();

startComposer.command("start", async (ctx) => {
  await ctx.reply(
    [
      "\u{1F9E0} <b>Welcome to Cobraine</b>",
      "",
      "Hey! I'm <b>Cobraine</b> \u2014 your second brain, powered by AI.",
      "",
      "Just send me a message and I'll help you out! Here is what I can do for you:",
      "• <b>Set reminders</b> directly in chat so you never miss a thing",
      "• <b>Create goals and plans</b> with milestone checkpoints to stay on track",
      "• <b>Save and retrieve documents</b>",
      "• <b>Remember photos and media</b> by description so you can easily find them later",
      "",
      "<b>Available commands:</b>",
      "/config \u2014 Configure your LLM provider and API key",
      "",
      "Let's get started! \u{1F680}",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
});

export default startComposer;