import { Context } from 'grammy';
import { ChatOpenAI } from '@langchain/openai';
import { UserService } from '../services/service.user';
import { User } from '../models/model.user';
import { AgentGraphInput } from '../agent/graph';
import { buildMessageContext } from '../agent/context';
import { Attachment } from '../types/types.agent';
import { UsageService } from '../services/service.usage';
import { buildLLM } from '../agent/factory';

/**
 * Receives a raw Telegram grammy Context and resolves it into a typed,
 * domain-aware object that the agent graph can consume.
 *
 * Responsibilities:
 *  - Extract Telegram identifiers (telegramId, chatId, text/caption, attachments)
 *  - Upsert and expose the domain User object
 *  - Gate usage (free quota / user-provided credentials)
 *  - Build the LLM instance for this request
 *  - Build the AgentGraphInput (messages + userContext + attachments) for graph invocation
 *
 * The agent graph and all downstream layers never see the raw Telegram ctx.
 */
export class TelegramReceiver {
    readonly telegramId: number;
    readonly chatId: number;
    /** The user's prompt text — falls back to caption when a media message is sent. */
    readonly text: string;
    readonly attachments: Attachment[];
    readonly user: User;

    /**
     * The ChatOpenAI instance to use for this request.
     * null if usage was denied (free quota exhausted, no provider configured).
     */
    readonly llm: ChatOpenAI | null;

    /**
     * If set, the user is not allowed to invoke the LLM.
     * Contains the denial message to send back.
     */
    readonly usageDenied: string | null;

    private constructor(
        telegramId: number,
        chatId: number,
        text: string,
        attachments: Attachment[],
        user: User,
        llm: ChatOpenAI | null,
        usageDenied: string | null,
    ) {
        this.telegramId = telegramId;
        this.chatId = chatId;
        this.text = text;
        this.attachments = attachments;
        this.user = user;
        this.llm = llm;
        this.usageDenied = usageDenied;
    }

    /**
     * Factory — call this in the Telegram handler before invoking the graph.
     * Handles user upsert and usage gating internally so the interaction layer stays clean.
     *
     * Text resolution priority:
     *   1. Explicit override (e.g. a resume answer from a callback query)
     *   2. ctx.message.text   (plain text message)
     *   3. ctx.message.caption (media message where user typed in the caption field)
     *   4. Empty string        (media-only, no text)
     */
    static async fromCtx(ctx: Context, textOverride?: string): Promise<TelegramReceiver> {
        const telegramId = ctx.from?.id;
        const chatId = ctx.chat?.id;
        const username = ctx.from?.username;
        const firstName = ctx.from?.first_name;

        if (!telegramId || !chatId) {
            throw new Error('TelegramReceiver: missing telegramId or chatId in ctx');
        }

        const messageText =
            textOverride ??
            ctx.message?.text ??
            ctx.message?.caption ??
            '';

        const attachments = TelegramReceiver.extractAttachments(ctx);

        const user = await UserService.upsertUser(telegramId, username, firstName);

        // ── Usage gating ──────────────────────────────────────────────────
        const usageResult = await UsageService.checkAndConsume(user.internalId);

        if (!usageResult.allowed) {
            return new TelegramReceiver(
                telegramId, chatId, messageText, attachments, user,
                null, usageResult.reason!,
            );
        }

        const llm = buildLLM(usageResult.providerConfig);
        // console.log("LLM for this user : ", llm)

        return new TelegramReceiver(
            telegramId, chatId, messageText, attachments, user,
            llm, null,
        );
    }

    // removed additionalMetadata as it's now handled natively by the agent node

    /**
     * Build the AgentGraphInput — resolves conversation history + system prompt
     * and packages everything the graph needs for a fresh invocation.
     */
    async buildGraphInput(): Promise<AgentGraphInput> {
        const messages = await buildMessageContext({
            userUuid: this.user.internalId,
            chatId: this.chatId,
            prompt: this.text,
            attachments: this.attachments,
        });

        return {
            messages,
            userContext: {
                telegramId: this.telegramId,
                chatId: this.chatId,
                userFullName: this.user.fullName,
                languageCode: this.user.languageCode ?? undefined,
            },
            attachments: this.attachments,
        };
    }

    /**
     * Extract all file attachments from the Telegram message.
     *
     * Grammy provides file metadata directly on ctx.message — bots receive
     * only file_id references, not the actual file data. The caption field
     * (the user's intent) is handled separately as `text`.
     *
     * For photos, Telegram sends an array of sizes — we take the largest (.at(-1)).
     */
    private static extractAttachments(ctx: Context): Attachment[] {
        const msg = ctx.message;
        if (!msg) return [];

        const attachments: Attachment[] = [];

        if (msg.document) {
            attachments.push({
                type: 'document',
                telegramFileId: msg.document.file_id,
                filename: msg.document.file_name,
                mimeType: msg.document.mime_type,
                size: msg.document.file_size,
            });
        }

        if (msg.photo) {
            // Telegram sends multiple resolutions; the last element is the largest.
            const largest = msg.photo.at(-1)!;
            attachments.push({
                type: 'photo',
                telegramFileId: largest.file_id,
                size: largest.file_size,
            });
        }

        if (msg.video) {
            attachments.push({
                type: 'video',
                telegramFileId: msg.video.file_id,
                mimeType: msg.video.mime_type,
                size: msg.video.file_size,
            });
        }

        if (msg.audio) {
            attachments.push({
                type: 'audio',
                telegramFileId: msg.audio.file_id,
                mimeType: msg.audio.mime_type,
                size: msg.audio.file_size,
                filename: msg.audio.file_name,
            });
        }

        if (msg.voice) {
            attachments.push({
                type: 'voice',
                telegramFileId: msg.voice.file_id,
                mimeType: msg.voice.mime_type,
                size: msg.voice.file_size,
            });
        }

        return attachments;
    }
}

