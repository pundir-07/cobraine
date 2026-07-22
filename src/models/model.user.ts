import { BotUser } from "../types/types.user";
import { UserRecord } from "../services/service.user";

export class User {
    // 1. Private/Readonly properties to enforce encapsulation
    public readonly internalId: string; // Your app's internal UUID
    public readonly telegramId: number;
    public firstName: string;
    public lastName: string | null;
    public languageCode: string;

    // 2. Private constructor forces the use of factory methods
    private constructor(params: {
        internalId: string;
        telegramId: number;
        firstName: string;
        lastName?: string | null;
        languageCode?: string | null;
    }) {
        this.internalId = params.internalId;
        this.telegramId = params.telegramId;
        this.firstName = params.firstName;
        this.lastName = params.lastName || null;
        this.languageCode = params.languageCode || 'en';
    }

    // 3. FACTORY: Create from Database
    static fromDatabase(dbRecord: UserRecord): User {
        return new User({
            internalId: dbRecord.id,
            telegramId: dbRecord.telegramId,
            firstName: dbRecord.firstName || "", // Fallback if somehow null
            lastName: null, // Note: The current DB schema might not have last_name mapped to UserRecord, we keep it null
            languageCode: 'en',
        });
    }

    // 4. FACTORY: Create from Telegram payload + Database UUID
    static fromTelegram(tgUser: BotUser, internalId: string): User {
        return new User({
            internalId: internalId,
            telegramId: tgUser.telegramUserId,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name,
            languageCode: tgUser.language_code,
        });
    }

    // 5. Domain Logic / Behavior
    get fullName(): string {
        return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
    }
    
    updateLanguage(newCode: string) {
        this.languageCode = newCode;
    }
}
