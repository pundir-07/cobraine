import { Bot } from "grammy";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN is required in the environment");
}

export const bot = new Bot(process.env.BOT_TOKEN);
