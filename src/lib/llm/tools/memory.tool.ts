import { ToolDefinition } from "../../../types/types.tools";
import { ReminderService } from "../../../services/service.reminder";

export const setReminderTool: ToolDefinition = {
    name: "memory_reload",
    description: "Create a new reminder for the user. The reminder will fire at the specified time.",
    parameters: [
        {
            name: "title",
            type: "string",
            description: "What the reminder is about",
            required: true,
        },
        {
            name: "date",
            type: "string",
            description:
                "Date for the reminder. Use formats like 25/12, 25/12/2026, or 25 Dec.",
            required: true,
        },
        {
            name: "time",
            type: "string",
            description:
                "Time for the reminder in 12h or 24h format (e.g., 9am, 9:30pm, 21:30). Must be in the future.",
            required: true,
        },
    ],
    async execute(args, userId, chatId) {
        const title = String(args.title ?? "");
        const date = String(args.date ?? "");
        const time = String(args.time ?? "");

        const result = await ReminderService.createReminderFromStrings({ chatId, userId, title, date, time });

        if (result.ok) {
            return result.display;
        }
        return result.error;
    },
    disabled: false
};