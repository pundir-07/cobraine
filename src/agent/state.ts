import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { Attachment } from './types/types.agent.attachment';

export interface UserContext {
    telegramId: number;
    chatId: number;
    userFullName: string;
    languageCode?: string;
}

export const StateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),
    attachments: Annotation<Attachment[]>({
        reducer: (_, y) => y,
        default: () => [],
    }),
    userContext: Annotation<UserContext>({
        reducer: (_, y) => y,
        default: () => ({
            telegramId: 0,
            chatId: 0,
            userFullName: 'User',
        }),
    }),
    activeAgent: Annotation<string>({
        reducer: (_, y) => y,
        default: () => 'main',
    }),
});

export type State = typeof StateAnnotation.State;
