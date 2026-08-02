import dotenv from "dotenv";
import startComposer from "./composer.start";
import configComposer from "./composer.config";
import { connectRedis, disconnectRedis } from "./lib/redis";
import { connectPostgres, closePostgres } from "./lib/postgres";
import { toolsManager } from "./lib/llm/tools";
import { bot } from "./lib/telegram";
import cobraineComposer from "./composer.cobraine";

dotenv.config();

async function main() {
    await connectRedis();
    await connectPostgres();
    await toolsManager.init(); // Initialize dynamic tools here!
    await bot.api.setChatMenuButton({
        menu_button: {
            type: "web_app",
            text: "Open Cobraine",
            web_app: {
                url: process.env.WEB_APP_URL!,
            },
        },
    });
    await bot.api.setMyCommands([
        {
            command: "start",
            description: "Welcome to Cobraine",
        },
        {
            command: "config",
            description: "Configure your LLM provider",
        },
    ]);
    bot.use(startComposer);
    bot.use(configComposer);
    bot.use(cobraineComposer)
    // bot.use(agentComposer);

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
