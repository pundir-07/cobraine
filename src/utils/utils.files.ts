import { bot } from "@/lib/telegram";

export async function downloadTelegramFile(fileId: string): Promise<Buffer> {
    const file = await bot.api.getFile(fileId);

    const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    const res = await fetch(url);

    return Buffer.from(await res.arrayBuffer());
}