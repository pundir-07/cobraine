import { Composer } from "grammy";

const startComposer = new Composer();

startComposer.command("start", async (ctx) => {
  await ctx.reply(
    [
      "\u{1F9E0} <b>Welcome to Cobraine</b>",
      "",
      "Hey! I'm <b>Cobraine</b> \u2014 your second brain, powered by AI.",
      "",
      "Just send me a message and I'll help you out. No commands needed.",
      "",
      "<b>Available commands:</b>",
      "/reminder \u2014 Set reminders and never miss a thing",
      "",
      "Let's get started! \u{1F680}",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
});

export default startComposer;