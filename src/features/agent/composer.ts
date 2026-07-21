import { Composer } from "grammy";
import { AgentInteraction } from "../../interactions/interaction.agent";
import { userInteraction } from "../../lib/userInteraction";

const agentComposer = new Composer();

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
    await next();
    return;
  }

  const userId = ctx.update.message?.from.id!;
  let interaction = userInteraction.get(userId);

  if (interaction?.type === "agent") {
    await interaction.handle(ctx);
    if (interaction.isFinished()) {
      userInteraction.delete(userId);
    }
    return;
  }

  // No active interaction — auto-start agent
  interaction = new AgentInteraction();
  userInteraction.set(userId, interaction);
  await interaction.initialise(ctx);
});

export default agentComposer;
