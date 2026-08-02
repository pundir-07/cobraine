import { Composer } from 'grammy';
import { TelegramReceiver } from './agent/telegram/receiver.telegram';
import { TelegramResponder } from './agent/telegram/responder.telegram';
import { runAgentGraph, resumeAgentGraph } from './agent/graph';
import { MessageService } from './services/service.message';

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
