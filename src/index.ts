import { Bot } from "grammy";
import dotenv from "dotenv";
import startComposer from "./features/start/composer";
import reminderComposer from "./features/reminders/composer";
import agentComposer from "./features/agent/composer";
import { connectRedis, disconnectRedis } from "./lib/redis";
import { connectPostgres, closePostgres } from "./lib/postgres";
dotenv.config();

async function main() {
    await connectRedis();
    await connectPostgres();
    const bot = new Bot(process.env.BOT_TOKEN!);
    await bot.api.setMyCommands([
        {
            command: "start",
            description: "Welcome to Cobraine",
        },
        {
            command: "reminder",
            description: "Create a new reminder",
        },
    ]);
    bot.use(startComposer);
    bot.use(reminderComposer);
    bot.use(agentComposer);

    process.once("SIGINT", async () => {
        await bot.stop();
        await closePostgres();
        await disconnectRedis();
        process.exit(0);
    });

    process.once("SIGTERM", async () => {
        await bot.stop();
        await closePostgres();
        await disconnectRedis();
        process.exit(0);
    });

    await bot.start();
}

main().catch((err) => {
    console.error("Failed to start bot:", err);
    process.exit(1);
});
