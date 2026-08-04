import { Bot } from "grammy";
import dotenv from "dotenv";
dotenv.config();
import { consola } from "consola";
import chalk from "chalk"
// consola.info("Server started");
// consola.success("Database connected");
// consola.warn("Rate limit reached");
// consola.error("Request failed");
// consola.box("Deployment complete");

let botToken = process.env[`BOT_TOKEN_${process.env.NODE_ENV}`]
if (!botToken) {
    console.error("BOT_TOKEN is required in the environment")
    throw new Error("BOT_TOKEN is required in the environment");
}
consola.box(chalk.cyan(`Environment: ${process.env.NODE_ENV}`))

export const bot = new Bot(botToken!);
