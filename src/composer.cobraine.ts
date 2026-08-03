import { Composer } from 'grammy';
import { TelegramReceiver } from './agent/telegram/receiver.telegram';
import { TelegramResponder } from './agent/telegram/responder.telegram';
import { runAgentGraph, resumeAgentGraph } from './agent/graph';
import { MessageService } from './services/service.message';
import { ReminderService } from './services/service.reminder';
import { InlineKeyboard } from 'grammy';
import { HumanMessage } from '@langchain/core/messages';

interface InterruptedState {
    type: 'agent_interrupted';
    telegramId: number;
    chatId: number;
}

/** In-process map of userId → interrupted state. Cleared when graph resumes. */
const interruptedSessions = new Map<number, InterruptedState>();

const cobraineComposer = new Composer();

// ─── Text messages ────────────────────────────────────────────────────────────

cobraineComposer.on(['message:text', "message:document", "message:photo", "message:video"], async (ctx, next) => {
    // Let command handlers run first
    if (ctx.message.text && ctx.message.text.startsWith('/')) {
        await next();
        return;
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const interrupted = interruptedSessions.get(userId);
    const thinking = await TelegramResponder.sendThinking(ctx);

    try {
        const receiver = await TelegramReceiver.fromCtx(ctx);

        // ── Usage gating ──────────────────────────────────────────────────
        if (receiver.usageDenied) {
            await TelegramResponder.resolve(ctx, thinking, receiver.usageDenied);
            return;
        }

        if (interrupted) {
            console.log('Continuing from interrupt')
            // Resume an interrupted graph thread with the user's text/media answer
            interruptedSessions.delete(userId);
            const result = await resumeAgentGraph(
                interrupted.telegramId,
                interrupted.chatId,
                receiver.text,
                receiver.llm!,
            );
            await handleGraphOutput(ctx, thinking, receiver, result);
        } else {
            console.log('Fresh invocation')
            // Fresh invocation
            await MessageService.saveMessage(
                receiver.user.internalId,
                receiver.chatId,
                'user',
                receiver.text,
            );

            const input = await receiver.buildGraphInput();
            const result = await runAgentGraph(input, receiver.llm!);

            await handleGraphOutput(ctx, thinking, receiver, result);
        }
    } catch (error) {
        await TelegramResponder.reject(ctx, thinking, error);
    }
});

// ─── Callback queries (inline keyboard answers) ───────────────────────────────

cobraineComposer.callbackQuery(/^cobraine:answer:/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const interrupted = interruptedSessions.get(userId);
    if (!interrupted) {
        await ctx.answerCallbackQuery({ text: 'Session expired. Send a new message.' });
        return;
    }

    const answer = ctx.callbackQuery.data.replace('cobraine:answer:', '');
    interruptedSessions.delete(userId);

    const thinking = { chatId: ctx.chat!.id, messageId: ctx.callbackQuery.message!.message_id };

    try {
        const receiver = await TelegramReceiver.fromCtx(ctx, answer);

        if (receiver.usageDenied) {
            await TelegramResponder.resolve(ctx, thinking, receiver.usageDenied);
            await ctx.answerCallbackQuery();
            return;
        }

        const result = await resumeAgentGraph(
            interrupted.telegramId,
            interrupted.chatId,
            answer,
            receiver.llm!,
        );
        await handleGraphOutput(ctx, thinking, receiver, result);
    } catch (error) {
        await TelegramResponder.reject(ctx, thinking, error);
    }

    await ctx.answerCallbackQuery();
});

cobraineComposer.callbackQuery(/^reminder:done:/, async (ctx) => {
    const reminderId = ctx.callbackQuery.data.replace('reminder:done:', '');
    await ReminderService.completeReminder(reminderId);

    const reminder = await ReminderService.getReminder(reminderId);

    // Update message to remove buttons
    try {
        await ctx.editMessageText(`✅ <b>Completed Reminder</b>\n\n${reminder?.title || 'Unknown reminder'}`, { parse_mode: 'HTML' });
    } catch (e) {
        // ignore
    }
    await ctx.answerCallbackQuery({ text: 'Marked as done!' });

    // Invoke goalAgent for feedback
    try {
        const receiver = await TelegramReceiver.fromCtx(ctx, '');
        const input = await receiver.buildGraphInput();
        input.messages.push(new HumanMessage(`I just completed my checkpoint reminder: "${reminder?.title}". Provide a highly motivational feedback!`));
        input.activeAgent = 'goalAgent';

        const thinking = { chatId: ctx.chat!.id, messageId: ctx.callbackQuery.message!.message_id };
        const result = await runAgentGraph(input, receiver.llm!);
        await handleGraphOutput(ctx, thinking, receiver, result);
    } catch (e) {
        console.error('Failed to invoke goalAgent for feedback', e);
    }
});

cobraineComposer.callbackQuery(/^reminder:snooze_menu:/, async (ctx) => {
    const reminderId = ctx.callbackQuery.data.replace('reminder:snooze_menu:', '');

    const keyboard = new InlineKeyboard()
        .text("15m", `reminder:snooze:15:${reminderId}`)
        .text("30m", `reminder:snooze:30:${reminderId}`)
        .text("1h", `reminder:snooze:60:${reminderId}`)
        .text("2h", `reminder:snooze:120:${reminderId}`)
        .row()
        .text("Custom", `reminder:snooze:custom:${reminderId}`);

    try {
        await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    } catch (e) {
        // ignore
    }
    await ctx.answerCallbackQuery();
});

cobraineComposer.callbackQuery(/^reminder:snooze:/, async (ctx) => {
    const parts = ctx.callbackQuery.data.split(':');
    const action = parts[2]; // '15', '30', '60', '120', 'custom'
    const reminderId = parts.slice(3).join(':');

    if (action === 'custom') {
        await ctx.answerCallbackQuery({ text: 'Custom snooze: Reply to this message with the time.', show_alert: true });
        return;
    }

    const minutes = parseInt(action, 10);
    const newRemindAt = new Date(Date.now() + minutes * 60 * 1000);
    await ReminderService.snoozeReminder(reminderId, newRemindAt);

    const reminder = await ReminderService.getReminder(reminderId);

    // Update message
    try {
        await ctx.editMessageText(`💤 <b>Snoozed Reminder</b>\n\n${reminder?.title || 'Unknown reminder'}\n<i>Snoozed until ${newRemindAt.toLocaleTimeString()}</i>`, { parse_mode: 'HTML' });
    } catch (e) {
        // ignore
    }
    await ctx.answerCallbackQuery({ text: `Snoozed for ${minutes} minutes.` });

    // Invoke goalAgent for feedback
    try {
        const receiver = await TelegramReceiver.fromCtx(ctx, '');
        const input = await receiver.buildGraphInput();
        input.messages.push(new HumanMessage(`I just snoozed my checkpoint reminder: "${reminder?.title}" for ${minutes} minutes. Be pushy and remind me not to stall.`));
        input.activeAgent = 'goalAgent';

        const thinking = { chatId: ctx.chat!.id, messageId: ctx.callbackQuery.message!.message_id };
        const result = await runAgentGraph(input, receiver.llm!);
        await handleGraphOutput(ctx, thinking, receiver, result);
    } catch (e) {
        console.error('Failed to invoke goalAgent for feedback', e);
    }
});

cobraineComposer.callbackQuery('cobraine:close', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) interruptedSessions.delete(userId);

    try {
        await ctx.deleteMessage();
    } catch {
        // Message may already be gone
    }
    await ctx.answerCallbackQuery();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function handleGraphOutput(
    ctx: any,
    thinking: { chatId: number; messageId: number },
    receiver: TelegramReceiver,
    result: Awaited<ReturnType<typeof runAgentGraph>>,
) {
    if (result.type === 'interrupted') {
        // Graph paused — send the question, mark session as interrupted
        interruptedSessions.set(receiver.telegramId, {
            type: 'agent_interrupted',
            telegramId: receiver.telegramId,
            chatId: receiver.chatId,
        });
        await TelegramResponder.sendQuestion(ctx, thinking, result.value);
    } else {
        // Graph completed — save response and send to user
        await MessageService.saveMessage(
            receiver.user.internalId,
            receiver.chatId,
            'assistant',
            result.content,
        );
        await TelegramResponder.resolve(ctx, thinking, result.content);
    }
}

export default cobraineComposer;
