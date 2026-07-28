import {
    BaseMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
} from '@langchain/core/messages';
import { MessageService } from '../services/service.message';
import { buildSystemPrompt } from '../lib/llm/prompt';

export interface MessageContextInput {
    userUuid: string;
    chatId: number;
    prompt: string;
    additionalMetadata?: string;
}

/**
 * Assembles the full message array to seed the agent graph:
 *   [SystemMessage, ...conversationHistory, HumanMessage(currentPrompt)]
 *
 * This is the only place that knows about MessageService and prompt building.
 * The graph itself receives a clean BaseMessage[] and stays infrastructure-agnostic.
 */
export async function buildMessageContext({
    userUuid,
    chatId,
    prompt,
    additionalMetadata,
}: MessageContextInput): Promise<BaseMessage[]> {
    const history = await MessageService.getConversationHistory(userUuid, chatId);
    const systemPrompt = buildSystemPrompt();

    const systemContent = additionalMetadata
        ? `${systemPrompt}\n\nADDITIONAL METADATA:\n\n${additionalMetadata}`
        : systemPrompt;

    const historyMessages: BaseMessage[] = history.map((msg) =>
        msg.role === 'user'
            ? new HumanMessage(msg.content)
            : new AIMessage(msg.content),
    );

    return [
        new SystemMessage(systemContent),
        ...historyMessages,
        new HumanMessage(prompt),
    ];
}
