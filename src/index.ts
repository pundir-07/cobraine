import { Bot } from "grammy";
import dotenv from "dotenv";
import reminderComposer from "./features/reminders/composer";
dotenv.config();

const bot = new Bot(process.env.BOT_TOKEN!);
bot.use(reminderComposer)
bot.start()