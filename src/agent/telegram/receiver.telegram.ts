import { Context } from 'grammy';
import { UserService } from '../../services/service.user';
import { User } from '../../models/model.user';
import { AgentGraphInput } from '../graph';
import { buildMessageContext } from '../context';

/**
 * Receives a raw Telegram grammy Context and resolves it into a typed,
 * domain-aware object that the agent graph can consume.
 *
 * Responsibilities:
 *  - Extract Telegram identifiers (telegramId, chatId, text)
 *  - Upsert and expose the domain User object
 *  - Build the AgentGraphInput (messages + userContext) for graph invocation
 *
 * The agent graph and all downstream layers never see the raw Telegram ctx.
 */
export class TelegramReceiver {
    readonly telegramId: number;
    readonly chatId: number;
    readonly text: string;
    readonly user: User;

    private constructor(
        telegramId: number,
        chatId: number,
        text: string,
        user: User,
    ) {
        this.telegramId = telegramId;
        this.chatId = chatId;
        this.text = text;
        this.user = user;
    }

    /**
     * Factory — call this in the Telegram handler before invoking the graph.
     * Handles user upsert internally so the interaction layer stays clean.
     */
    static async fromCtx(ctx: Context, text?: string): Promise<TelegramReceiver> {
        const telegramId = ctx.from?.id;
        const chatId = ctx.chat?.id;
        const username = ctx.from?.username;
        const firstName = ctx.from?.first_name;
        const messageText = text ?? ctx.message?.text ?? '';

        if (!telegramId || !chatId) {
            throw new Error('TelegramReceiver: missing telegramId or chatId in ctx');
        }

        const user = await UserService.upsertUser(telegramId, username, firstName);

        return new TelegramReceiver(telegramId, chatId, messageText, user);
    }

    /** Additional metadata string injected into the system prompt. */
    get additionalMetadata(): string {
        return `User Name: ${this.user.fullName}\nLanguage: ${this.user.languageCode ?? 'en'}`;
    }

    /**
     * Build the AgentGraphInput — resolves conversation history + system prompt
     * and packages everything the graph needs for a fresh invocation.
     */
    async buildGraphInput(): Promise<AgentGraphInput> {
        const messages = await buildMessageContext({
            userUuid: this.user.internalId,
            chatId: this.chatId,
            prompt: this.text,
            additionalMetadata: this.additionalMetadata,
        });

        return {
            messages,
            userContext: {
                telegramId: this.telegramId,
                chatId: this.chatId,
                userFullName: this.user.fullName,
                languageCode: this.user.languageCode ?? undefined,
            },
        };
    }
}
