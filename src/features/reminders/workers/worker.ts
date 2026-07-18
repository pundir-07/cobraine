import { Bot } from "grammy";
import dotenv from "dotenv";
import { connectRedis, disconnectRedis } from "../../../lib/redis";
import {
    claimDueReminder,
    completeReminder,
    failReminder,
    getReminder,
    recoverOneStaleReminder,
} from "../service";
import { escapeHtml } from "../utils";

dotenv.config();

const POLL_INTERVAL_MS = 1_000;

async function main() {
    await connectRedis();

    const bot = new Bot(process.env.BOT_TOKEN!);

    process.once("SIGINT", () => shutdown());
    process.once("SIGTERM", () => shutdown());

    while (true) {
        await recoverStaleReminders();
        await processDueReminder(bot);
        await sleep(POLL_INTERVAL_MS);
    }
}

async function processDueReminder(bot: Bot) {
    const reminderId = await claimDueReminder();

    if (!reminderId) return;

    try {
        const reminder = await getReminder(reminderId);

        if (!reminder) {
            await completeReminder(reminderId);
            return;
        }

        await bot.api.sendMessage(
            Number(reminder.chatId),
            `🔔 <b>Reminder</b>\n\n${escapeHtml(reminder.title)}`,
            { parse_mode: "HTML" },
        );

        await completeReminder(reminderId);
    } catch (error) {
        await failReminder(reminderId, error);
    }
}

async function recoverStaleReminders() {
    while (await recoverOneStaleReminder()) {
        // Keep recovering until there are no stale processing reminders left.
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shutdown() {
    await disconnectRedis();
    process.exit(0);
}

main().catch((error) => {
    console.error("Reminder worker failed:", error);
    process.exit(1);
});
