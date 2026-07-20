import { ToolDefinition } from "./types";
import { createReminder, listUserReminders } from "../../reminders/service";

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
        "Date for the reminder in DD/MM/YYYY format (e.g., 25/12/2026). If only a time is given, use today's date.",
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
    const dateStr = String(args.date ?? "");
    const timeStr = String(args.time ?? "");

    if (!title || !dateStr || !timeStr) {
      return "Missing required fields: title, date, and time are all needed.";
    }

    // Parse date
    const dateParts = dateStr.split("/");
    let day: number, month: number, year: number;

    if (dateParts.length === 3) {
      day = parseInt(dateParts[0], 10);
      month = parseInt(dateParts[1], 10) - 1;
      year = parseInt(dateParts[2], 10);
    } else if (dateParts.length === 2) {
      day = parseInt(dateParts[0], 10);
      month = parseInt(dateParts[1], 10) - 1;
      year = new Date().getFullYear();
    } else {
      return `Could not parse date "${dateStr}". Use DD/MM/YYYY format.`;
    }

    // Parse time
    const timeLower = timeStr.toLowerCase().trim();
    let hours: number, minutes: number;

    const amPmMatch = timeLower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    const militaryMatch = timeLower.match(/^(\d{1,2}):(\d{2})$/);

    if (amPmMatch) {
      hours = parseInt(amPmMatch[1], 10);
      minutes = amPmMatch[2] ? parseInt(amPmMatch[2], 10) : 0;
      const meridian = amPmMatch[3];
      if (meridian === "pm" && hours !== 12) hours += 12;
      if (meridian === "am" && hours === 12) hours = 0;
    } else if (militaryMatch) {
      hours = parseInt(militaryMatch[1], 10);
      minutes = parseInt(militaryMatch[2], 10);
    } else {
      return `Could not parse time "${timeStr}". Use formats like 9am, 9:30pm, or 21:30.`;
    }

    const remindAt = new Date(year, month, day, hours, minutes);

    if (isNaN(remindAt.getTime())) {
      return `Could not parse date/time from "${dateStr}" "${timeStr}".`;
    }

    try {
      const reminder = await createReminder({ chatId, userId, title, remindAt });

      if (!reminder) {
        return "The reminder was created but I couldn't retrieve the details. It should still fire at the right time.";
      }

      return [
        `Reminder set: "${title}"`,
        `When: ${remindAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} at ${remindAt.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}`,
      ].join("\n");
    } catch (error) {
      return `Failed to create reminder: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
};

export const listRemindersTool: ToolDefinition = {
  name: "list_reminders",
  description: "List all currently scheduled reminders for the user.",
  parameters: [],
  async execute(_args, userId) {
    try {
      const reminders = await listUserReminders(userId);
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