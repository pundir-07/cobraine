import { Composer, InlineKeyboard, Context } from 'grammy';
import { UserService } from './services/service.user';
import { ProviderService } from './services/service.provider';

// ─── Provider metadata ───────────────────────────────────────────────────────

interface ProviderMeta {
    label: string;
    defaultModel: string;
}

const PROVIDERS: Record<string, ProviderMeta> = {
    openrouter: { label: '🌐 OpenRouter', defaultModel: 'openrouter/free' },
    openai:     { label: '🤖 OpenAI',     defaultModel: 'gpt-4o-mini' },
    anthropic:  { label: '🟤 Anthropic',  defaultModel: 'claude-3-5-sonnet-latest' },
    deepseek:   { label: '🐳 DeepSeek',   defaultModel: 'deepseek-chat' },
};

// ─── In-process config session state ──────────────────────────────────────────

interface ConfigSession {
    step: 'awaiting_provider' | 'awaiting_key' | 'awaiting_model' | 'awaiting_confirm';
    provider?: string;
    apiKey?: string;
    model?: string;
    suggestions?: string[];
    /** The message ID of the bot's prompt message (to edit it through the flow). */
    promptMessageId?: number;
}

/** userId → active config session */
const configSessions = new Map<number, ConfigSession>();

// ─── Composer ─────────────────────────────────────────────────────────────────

const configComposer = new Composer();

// ─── /config command ──────────────────────────────────────────────────────────

configComposer.command('config', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const keyboard = new InlineKeyboard();
    for (const [key, meta] of Object.entries(PROVIDERS)) {
        keyboard.text(meta.label, `config:provider:${key}`).row();
    }
    keyboard.text('❌ Cancel', 'config:cancel');

    const msg = await ctx.reply(
        [
            '⚙️ <b>LLM Provider Configuration</b>',
            '',
            'Select your LLM provider to configure your own API key.',
            '',
            '<i>Tip: OpenRouter offers many free models!</i>',
        ].join('\n'),
        { parse_mode: 'HTML', reply_markup: keyboard },
    );

    configSessions.set(userId, {
        step: 'awaiting_provider',
        promptMessageId: msg.message_id,
    });
});

// ─── Step 1: Provider selected ────────────────────────────────────────────────

configComposer.callbackQuery(/^config:provider:/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const session = configSessions.get(userId);
    if (!session || session.step !== 'awaiting_provider') {
        await ctx.answerCallbackQuery({ text: 'Session expired. Run /config again.' });
        return;
    }

    const provider = ctx.callbackQuery.data.replace('config:provider:', '');
    if (!PROVIDERS[provider]) {
        await ctx.answerCallbackQuery({ text: 'Unknown provider.' });
        return;
    }

    session.provider = provider;
    session.step = 'awaiting_key';
    configSessions.set(userId, session);

    // Edit the original message to ask for the API key
    await ctx.editMessageText(
        [
            '⚙️ <b>LLM Provider Configuration</b>',
            '',
            `Provider: <b>${PROVIDERS[provider].label}</b>`,
            '',
            '🔑 <b>Now send your API key as a text message.</b>',
            '',
            '<i>Your message will be deleted immediately for security.</i>',
        ].join('\n'),
        {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard().text('❌ Cancel', 'config:cancel'),
        },
    );

    await ctx.answerCallbackQuery();
});

// ─── Step 2.5: Model selected via inline button ───────────────────────────────

configComposer.callbackQuery(/^config:model:/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const session = configSessions.get(userId);
    if (!session || session.step !== 'awaiting_model') {
        await ctx.answerCallbackQuery({ text: 'Session expired. Run /config again.' });
        return;
    }

    const idx = parseInt(ctx.callbackQuery.data.replace('config:model:', ''), 10);
    const model = session.suggestions?.[idx];

    if (!model) {
        await ctx.answerCallbackQuery({ text: 'Model not found.' });
        return;
    }

    session.model = model;
    session.step = 'awaiting_confirm';
    configSessions.set(userId, session);

    await showConfirmationDialog(ctx, userId, session);
    await ctx.answerCallbackQuery();
});

// ─── Step 2: API key received / Manual Model received ─────────────────────────

configComposer.on('message:text', async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) {
        await next();
        return;
    }

    const session = configSessions.get(userId);
    if (!session) {
        await next();
        return;
    }

    if (session.step === 'awaiting_key') {
        const apiKey = ctx.message.text.trim();

        try { await ctx.deleteMessage(); } catch {}

        if (!apiKey || apiKey.startsWith('/')) {
            if (apiKey.startsWith('/')) await next();
            return;
        }

        session.apiKey = apiKey;
        session.step = 'awaiting_model';
        configSessions.set(userId, session);

        try {
            await ctx.api.editMessageText(
                ctx.chat.id,
                session.promptMessageId!,
                '<i>Fetching available models...</i>',
                { parse_mode: 'HTML' }
            );
        } catch {}

        const suggestions = await fetchSuggestedModels(session.provider!, apiKey);
        session.suggestions = suggestions;

        const keyboard = new InlineKeyboard();
        suggestions.forEach((model, i) => {
            keyboard.text(model, `config:model:${i}`).row();
        });
        keyboard.text('❌ Cancel', 'config:cancel');

        try {
            await ctx.api.editMessageText(
                ctx.chat.id,
                session.promptMessageId!,
                [
                    '⚙️ <b>LLM Provider Configuration</b>',
                    '',
                    `Provider: <b>${PROVIDERS[session.provider!].label}</b>`,
                    `API Key: <code>${maskKey(apiKey)}</code>`,
                    '',
                    '🧠 <b>Select a model below, or type one manually.</b>',
                ].join('\n'),
                {
                    parse_mode: 'HTML',
                    reply_markup: keyboard,
                },
            );
        } catch {}
        return;
    }

    if (session.step === 'awaiting_model') {
        const model = ctx.message.text.trim();
        
        try { await ctx.deleteMessage(); } catch {}

        if (!model || model.startsWith('/')) {
            if (model.startsWith('/')) await next();
            return;
        }

        session.model = model;
        session.step = 'awaiting_confirm';
        configSessions.set(userId, session);

        await showConfirmationDialog(ctx, userId, session);
        return;
    }

    await next();
});

// ─── Step 3: Save confirmed ──────────────────────────────────────────────────

configComposer.callbackQuery('config:save', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const session = configSessions.get(userId);
    if (!session || session.step !== 'awaiting_confirm' || !session.provider || !session.apiKey || !session.model) {
        await ctx.answerCallbackQuery({ text: 'Session expired. Run /config again.' });
        configSessions.delete(userId);
        return;
    }

    // Resolve user UUID from telegram_id
    const user = await UserService.getUserByTelegramId(userId);
    if (!user) {
        await ctx.answerCallbackQuery({ text: 'User not found. Send /start first.' });
        configSessions.delete(userId);
        return;
    }

    try {
        await ProviderService.upsertConfig(
            user.internalId,
            session.provider,
            session.apiKey,
            session.model,
        );

        await ctx.editMessageText(
            [
                '⚙️ <b>LLM Provider Configuration</b>',
                '',
                '✅ <b>Configuration saved successfully!</b>',
                '',
                `Provider: <b>${PROVIDERS[session.provider].label}</b>`,
                `Model: <code>${session.model}</code>`,
                '',
                'Your API key is encrypted and stored securely.',
                'All future AI messages will use your own credentials.',
            ].join('\n'),
            { parse_mode: 'HTML' },
        );
    } catch (err) {
        await ctx.editMessageText(
            [
                '⚙️ <b>LLM Provider Configuration</b>',
                '',
                `❌ <b>Failed to save config:</b> ${err instanceof Error ? err.message : 'Unknown error'}`,
                '',
                'Please try again with /config.',
            ].join('\n'),
            { parse_mode: 'HTML' },
        );
    }

    configSessions.delete(userId);
    await ctx.answerCallbackQuery();
});

// ─── Cancel ──────────────────────────────────────────────────────────────────

configComposer.callbackQuery('config:cancel', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) configSessions.delete(userId);

    await ctx.editMessageText(
        '⚙️ <b>Configuration cancelled.</b>\n\nRun /config anytime to set up your LLM provider.',
        { parse_mode: 'HTML' },
    );
    await ctx.answerCallbackQuery();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function showConfirmationDialog(ctx: Context, userId: number, session: ConfigSession) {
    if (!ctx.chat) return;

    const masked = maskKey(session.apiKey!);
    const keyboard = new InlineKeyboard()
        .text('✅ Save Config', 'config:save').row()
        .text('❌ Cancel', 'config:cancel');

    const text = [
        '⚙️ <b>LLM Provider Configuration</b>',
        '',
        `Provider: <b>${PROVIDERS[session.provider!].label}</b>`,
        `Model: <code>${session.model}</code>`,
        `API Key: <code>${masked}</code>`,
        '',
        'Review and press <b>Save Config</b> to confirm.',
    ].join('\n');

    try {
        await ctx.api.editMessageText(
            ctx.chat.id,
            session.promptMessageId!,
            text,
            { parse_mode: 'HTML', reply_markup: keyboard },
        );
    } catch {
        const msg = await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        session.promptMessageId = msg.message_id;
        configSessions.set(userId, session);
    }
}

function maskKey(key: string): string {
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 4)}${'•'.repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
}

async function fetchSuggestedModels(provider: string, apiKey: string): Promise<string[]> {
    try {
        if (provider === 'openrouter') {
            const res = await fetch('https://openrouter.ai/api/v1/models');
            if (res.ok) {
                const data = await res.json();
                const freeModels = data.data
                    .filter((m: any) => m.pricing && m.pricing.prompt === '0')
                    .map((m: any) => m.id);
                return ['openrouter/free', ...freeModels.slice(0, 9)];
            }
        } else if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (res.ok) {
                const data = await res.json();
                const chatModels = data.data
                    .map((m: any) => m.id)
                    .filter((id: string) => id.includes('gpt') || id.includes('o1'));
                return chatModels.slice(0, 10);
            }
        }
    } catch (err) {
        console.error(`Failed to fetch models for ${provider}:`, err);
    }
    
    // Fallbacks
    if (provider === 'openai') return ['gpt-4o-mini', 'gpt-4o', 'o1-mini', 'o1-preview'];
    if (provider === 'anthropic') return ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'];
    if (provider === 'openrouter') return ['openrouter/free', 'google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.1-8b-instruct:free'];
    if (provider === 'deepseek') return ['deepseek-chat', 'deepseek-reasoner'];
    
    return [];
}

export default configComposer;

