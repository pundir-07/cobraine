import { Composer } from "grammy";
import { Interaction } from "../../types";
import { ReminderInteraction } from "./handlers";
const reminderComposer = new Composer();

const userInteraction = new Map<number, Interaction>();

reminderComposer.command("reminder", async (ctx) => {
  const userId = ctx.update.message?.from.id!;
  let interaction = userInteraction.get(userId);
  if (!interaction) {
    interaction = new ReminderInteraction();
    userInteraction.set(userId, interaction);
  }
  interaction.initialise(ctx);
});
reminderComposer.callbackQuery(/^reminder:/, async (ctx) => {
  const userId = ctx.update.callback_query?.from.id!;
  let interaction = userInteraction.get(userId);
  if(interaction?.type=="reminder"){
    interaction?.handle(ctx);
  }
});

reminderComposer.on("message:text", async (ctx) => {
  const userId = ctx.update.message?.from.id!;
  let interaction = userInteraction.get(userId);
  if (interaction?.type == "reminder") {
    interaction?.handle(ctx);
  }
});

export default reminderComposer;
