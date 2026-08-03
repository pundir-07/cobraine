export type AgentCallbackQuery = "agent:close";

export interface AgentData {
    chatId: number;
    uiMessageId: number;
}
export type Attachment = {
    type:
    | "document"
    | "photo"
    | "video"
    | "audio"
    | "voice";

    telegramFileId: string;

    filename?: string;

    mimeType?: string;

    size?: number;

    caption?: string;
}