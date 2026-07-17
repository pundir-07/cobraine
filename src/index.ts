import { Bot } from "grammy";
import dotenv from "dotenv";
import reminderComposer from "./features/reminders/composer";
import { connectRedis } from "./lib/redis";
dotenv.config();

async function main() {
	await connectRedis();
	const bot = new Bot(process.env.BOT_TOKEN!);
	bot.use(reminderComposer);
	await bot.start();
}

main().catch((err) => {
	console.error('Failed to start bot:', err);
	process.exit(1);
});