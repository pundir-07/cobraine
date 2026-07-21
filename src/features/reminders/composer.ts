import { Composer } from "grammy";
import { ReminderInteraction } from "../../interactions/interaction.reminder";
import { userInteraction } from "../../lib/userInteraction";
const reminderComposer = new Composer();

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

reminderComposer.on("message:text", async (ctx,next) => {
  if(ctx.update.message.text.startsWith("/")){
    next()
    return;
  }
  const userId = ctx.update.message?.from.id!;
  let interaction = userInteraction.get(userId);
  if (interaction?.type == "reminder") {
    await interaction.handle(ctx);
    if (interaction.isFinished()) {
      userInteraction.delete(userId);
    }
  }else{
    await next()
  }
});

export default reminderComposer;
