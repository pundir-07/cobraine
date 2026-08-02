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