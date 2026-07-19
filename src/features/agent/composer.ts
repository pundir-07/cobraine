import { Composer } from "grammy";
import { AgentInteraction } from "./handlers";
import { userInteraction } from "../../lib/userInteraction";

const agentComposer = new Composer();

agentComposer.command("agent", async (ctx) => {
  const userId = ctx.update.message?.from.id!;
  const interaction = new AgentInteraction();

  userInteraction.set(userId, interaction);
  await interaction.initialise(ctx);
});

agentComposer.callbackQuery(/^agent:/, async (ctx) => {
  const userId = ctx.update.callback_query?.from.id!;
  const interaction = userInteraction.get(userId);

  if (interaction?.type === "agent") {
    await interaction.handle(ctx);
    if (interaction.isFinished()) {
      userInteraction.delete(userId);
    }
  }
});

agentComposer.on("message:text", async (ctx, next) => {
  if (ctx.update.message.text.startsWith("/")) {
    next();
    return;
  }

  const userId = ctx.update.message?.from.id!;
  const interaction = userInteraction.get(userId);

  if (interaction?.type === "agent") {
    await interaction.handle(ctx);
    if (interaction.isFinished()) {
      userInteraction.delete(userId);
    }
  }
});

export default agentComposer;
