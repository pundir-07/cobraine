import { Composer } from "grammy";
import { ReminderInteraction } from "./handlers";
const reminderComposer = new Composer();

const userInteraction = new Map<number, ReminderInteraction>();

reminderComposer.command("reminder", async (ctx) => {
  const userId = ctx.update.message?.from.id!;
  const interaction = new ReminderInteraction();

  userInteraction.set(userId, interaction);
  await interaction.initialise(ctx);
});
reminderComposer.callbackQuery(/^reminder:/, async (ctx) => {
  const userId = ctx.update.callback_query?.from.id!;
  let interaction = userInteraction.get(userId);
  if(interaction?.type=="reminder"){
    await interaction.handle(ctx);
    if (interaction.isFinished()) {
      userInteraction.delete(userId);
    }
  }
});

reminderComposer.on("message:text", async (ctx) => {
  const userId = ctx.update.message?.from.id!;
  let interaction = userInteraction.get(userId);
  if (interaction?.type == "reminder") {
    await interaction.handle(ctx);
    if (interaction.isFinished()) {
      userInteraction.delete(userId);
    }
  }
});

export default reminderComposer;
