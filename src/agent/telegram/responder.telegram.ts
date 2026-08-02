import { Context, InlineKeyboard } from 'grammy';
import { AskUserPayload } from '../tools/tool.ask_user';

interface ThinkingMessage {
    chatId: number;
    messageId: number;
}

/**
 * Handles all outbound Telegram API calls on behalf of the agent.
 * This is the ONLY layer that knows about the Telegram API in the new architecture.
 *
 * Responsibilities:
 *  - Send the "thinking" indicator message
 *  - Edit it with the final response or error
 *  - Send mid-workflow questions (from graph interrupts) with optional inline keyboard
 *
 * No business logic. No service calls. Strictly Telegram presentation.
 */
export class TelegramResponder {
    /**
     * Send the initial "thinking" message and return its reference.
     * Hold this reference to edit/resolve the message later.
     */
    static async sendThinking(ctx: Context): Promise<ThinkingMessage> {
        const msg = await ctx.reply('🤖 <b>Agent</b> is thinking...', {
            parse_mode: 'HTML',
        });
        return { chatId: msg.chat.id, messageId: msg.message_id };
    }

    /**
     * Resolve a thinking message with the agent's final response.
     */
    static async resolve(
        ctx: Context,
        thinking: ThinkingMessage,
        content: string,
    ): Promise<void> {
        await ctx.api.editMessageText(
            thinking.chatId,
            thinking.messageId,
            `🤖 <b>Agent</b>\n\n${formatTelegramHtml(content)}`,
            { parse_mode: 'HTML' },
        );
    }

    /**
     * Resolve a thinking message with an error notification.
     */
    static async reject(
        ctx: Context,
        thinking: ThinkingMessage,
        error: unknown,
    ): Promise<void> {
        const message =
            error instanceof Error ? formatTelegramHtml(error.message) : 'Unknown error';
        await ctx.api.editMessageText(
            thinking.chatId,
            thinking.messageId,
            `🤖 <b>Agent</b>\n\n❌ Error: ${message}`,
            {
                parse_mode: 'HTML',
                reply_markup: new InlineKeyboard().text('❌ Close', 'cobraine:close'),
            },
        );
    }

    /**
     * Send a mid-workflow question from a graph interrupt.
     * If the payload contains options, they are rendered as an inline keyboard.
     * If no options, the user responds with a free-text reply.
     */
    static async sendQuestion(
        ctx: Context,
        thinking: ThinkingMessage,
        payload: AskUserPayload,
    ): Promise<void> {
        if (payload.options && payload.options.length > 0) {
            const keyboard = new InlineKeyboard();
            payload.options.forEach((option) => {
                keyboard.text(option, `cobraine:answer:${option}`).row();
            });

            await ctx.api.editMessageText(
                thinking.chatId,
                thinking.messageId,
                `🤖 <b>Agent</b>\n\n${formatTelegramHtml(payload.question)}`,
                {
                    parse_mode: 'HTML',
                    reply_markup: keyboard,
                },
            );
        } else {
            // Free-text: edit the thinking message to show the question
            await ctx.api.editMessageText(
                thinking.chatId,
                thinking.messageId,
                `🤖 <b>Agent</b>\n\n${formatTelegramHtml(payload.question)}`,
                { parse_mode: 'HTML' },
            );
        }
    }
}

/**
 * Safely converts standard Markdown into Telegram-compatible HTML.
 * It first escapes all bare HTML entities, then maps markdown tags 
 * (bold, italic, code, headers, strikethrough) to Telegram HTML tags.
 */
function formatTelegramHtml(text: string): string {
    // 1. Escape HTML first to prevent any literal < > from breaking Telegram
    let safe = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 2. Convert markdown to Telegram HTML
    safe = safe
        // Code blocks: ```language\ncode\n```
        .replace(/```(?:[a-z0-9]+)?\n([\s\S]*?)```/g, '<pre>$1</pre>')
        // Inline code: `text`
        .replace(/`([^`\n]+)`/g, '<code>$1</code>')
        // Bold: **text**
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        // Italic: *text* (be careful with lists like * item)
        .replace(/(^|[^\w*])\*([^*\n\s][^*\n]*?[^*\n\s]|[^*\n\s])\*(?=[^\w*]|$)/g, '$1<i>$2</i>')
        // Italic: _text_
        .replace(/(^|[^\w_])_([^\n_\s][^\n_]*?[^\n_\s]|[^\n_\s])_(?=[^\w_]|$)/g, '$1<i>$2</i>')
        // Headers: # Heading -> <b>Heading</b>
        .replace(/^#+\s+(.*)$/gm, '<b>$1</b>')
        // Strikethrough: ~~text~~
        .replace(/~~([^~]+)~~/g, '<s>$1</s>');

    // 3. Unescape valid HTML tags that the LLM might have output due to context history
    safe = safe.replace(/&lt;(b|i|u|s|code|pre)&gt;/gi, '<$1>');
    safe = safe.replace(/&lt;\/(b|i|u|s|code|pre)&gt;/gi, '</$1>');

    return safe;
}
