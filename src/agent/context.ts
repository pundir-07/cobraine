import {
    BaseMessage,
    HumanMessage,
    AIMessage,
} from '@langchain/core/messages';
import { MessageService } from '../services/service.message';
import { Attachment } from './types/types.agent.attachment';

export interface MessageContextInput {
    userUuid: string;
    chatId: number;
    prompt: string;
    attachments?: Attachment[];
}

/**
 * Assembles the full message array to seed the agent graph:
 *   [SystemMessage, ...conversationHistory, HumanMessage(currentPrompt)]
 *
 * If attachments are present they are described inline in the HumanMessage
 * so the LLM can reason about them. The actual file content is not sent here —
 * only metadata (type, filename, mimeType). Tools that need the file can use
 * the telegramFileId to download it via the Bot API.
 *
 * This is the only place that knows about MessageService and prompt building.
 */
export async function buildMessageContext({
    userUuid,
    chatId,
    prompt,
    attachments,
}: MessageContextInput): Promise<BaseMessage[]> {
    const history = await MessageService.getConversationHistory(userUuid, chatId);

    const historyMessages: BaseMessage[] = history.map((msg) =>
        msg.role === 'user'
            ? new HumanMessage(msg.content)
            : new AIMessage(msg.content),
    );

    const userContent = buildUserContent(prompt, attachments);

    return [
        ...historyMessages,
        new HumanMessage(userContent),
    ];
}

/**
 * Build the human turn content string.
 * If attachments are present, they are appended as a structured note
 * so the LLM knows what files accompanied the message.
 */
function buildUserContent(prompt: string, attachments?: Attachment[]): string {
    if (!attachments || attachments.length === 0) {
        return prompt;
    }

    const attachmentLines = attachments.map((a) => {
        const parts = [`[Attachment: ${a.type}`];
        if (a.filename) parts.push(`filename="${a.filename}"`);
        if (a.mimeType) parts.push(`mimeType="${a.mimeType}"`);
        if (a.size) parts.push(`size=${a.size}bytes`);
        parts.push(`fileId="${a.telegramFileId}"`);
        parts.push(']');
        return parts.join(' ');
    });

    const attachmentBlock = `\n\n<attachments>\n${attachmentLines.join('\n')}\n</attachments>`;

    return prompt
        ? `${prompt}${attachmentBlock}`
        : `(no text message — see attachments)${attachmentBlock}`;
}
