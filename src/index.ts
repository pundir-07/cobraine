import { Bot } from "grammy";
import dotenv from "dotenv";
import startComposer from "./features/composer.start";
import reminderComposer from "./features/composer.reminder";
import agentComposer from "./features/composer.agent";
import { connectRedis, disconnectRedis } from "./lib/redis";
import { connectPostgres, closePostgres } from "./lib/postgres";
import { toolsManager } from "./lib/llm/tools";
import { bot } from "./lib/telegram";

dotenv.config();

async function main() {
    await connectRedis();
    await connectPostgres();
    await toolsManager.init(); // Initialize dynamic tools here!
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
