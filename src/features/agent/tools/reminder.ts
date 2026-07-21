import { ToolDefinition } from "./types";
import { ReminderService } from "../../../services/service.reminder";

export const setReminderTool: ToolDefinition = {
  name: "set_reminder",
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
};

export const listRemindersTool: ToolDefinition = {
  name: "list_reminders",
  description: "List all currently scheduled reminders for the user.",
  parameters: [],
  async execute(_args, userId) {
    try {
      const reminders = await ReminderService.listUserReminders(userId);
      const active = reminders.filter(
        (r) => r.status === "scheduled" || r.status === "processing",
      );

      if (active.length === 0) {
        return "You don't have any upcoming reminders.";
      }

      const lines = active.map((r, i) => {
        const when = new Date(r.remindAt);
        return `${i + 1}. "${r.title}" — ${when.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at ${when.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}`;
      });

      return ["Your scheduled reminders:", ...lines].join("\n");
    } catch (error) {
      return `Failed to list reminders: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
};