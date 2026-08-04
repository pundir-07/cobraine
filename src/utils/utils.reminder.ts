import { formatDateTimeForUser, formatDateForUser as fDateUser, formatTimeForUser as fTimeUser } from "./utils.time";

const MONTHS: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Creates a UTC Date representing the given local time in the specified timezone.
 */
function createDateInTimezone(year: number, month: number, day: number, hour: number, minute: number, timezone: string): Date {
    const utcDate = new Date(Date.UTC(year, month, day, hour, minute, 0));
    
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(utcDate);

    const localYear = Number(parts.find(p => p.type === 'year')!.value);
    const localMonth = Number(parts.find(p => p.type === 'month')!.value) - 1;
    const localDay = Number(parts.find(p => p.type === 'day')!.value);
    const localHour = Number(parts.find(p => p.type === 'hour')!.value) % 24; // Handle 24 vs 0
    const localMinute = Number(parts.find(p => p.type === 'minute')!.value);

    const shiftMs = Date.UTC(localYear, localMonth, localDay, localHour, localMinute, 0) - utcDate.getTime();
    
    return new Date(utcDate.getTime() - shiftMs);
}

/**
 * Get current year, month, day in the user's timezone.
 */
function getNowInTimezone(timezone: string) {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(now);

    return {
        year: Number(parts.find(p => p.type === 'year')!.value),
        month: Number(parts.find(p => p.type === 'month')!.value) - 1,
        day: Number(parts.find(p => p.type === 'day')!.value),
        hour: Number(parts.find(p => p.type === 'hour')!.value) % 24,
        minute: Number(parts.find(p => p.type === 'minute')!.value),
        nowUtc: now
    };
}

export function parseDate(input: string, timezone: string): Date | null {
    input = input.trim().toLowerCase();
    const nowTz = getNowInTimezone(timezone);

    let day: number;
    let month: number;
    let year = nowTz.year;

    let m = input.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    if (m) {
        day = Number(m[1]);
        month = Number(m[2]) - 1;
        if (m[3]) year = Number(m[3]);
    } else {
        m = input.match(/^(\d{1,2})\s+([a-z]{3})$/);
        if (!m) return null;
        day = Number(m[1]);
        if (!(m[2] in MONTHS)) return null;
        month = MONTHS[m[2]];
    }

    // Reject invalid dates (e.g. 31 Feb)
    const testDate = new Date(Date.UTC(year, month, day));
    if (testDate.getUTCFullYear() !== year || testDate.getUTCMonth() !== month || testDate.getUTCDate() !== day) {
        return null;
    }

    // Schedule for next year if the date has passed
    if (!m?.[3]) {
        // Compare midnight of target date with today in the timezone
        if (month < nowTz.month || (month === nowTz.month && day < nowTz.day)) {
            year += 1;
        }
    }

    // Return the Date object corresponding to midnight in the target timezone
    return createDateInTimezone(year, month, day, 0, 0, timezone);
}

export function parseTime(input: string, date: Date, timezone: string): Date | null {
    input = input.trim().toLowerCase();

    let hour: number;
    let minute: number;

    let m = input.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
        hour = Number(m[1]);
        minute = Number(m[2]);
        if (hour > 23 || minute > 59) return null;
    } else {
        m = input.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
        if (!m) return null;
        hour = Number(m[1]);
        minute = Number(m[2] ?? 0);
        if (hour < 1 || hour > 12 || minute > 59) return null;
        if (m[3] === "pm" && hour !== 12) hour += 12;
        if (m[3] === "am" && hour === 12) hour = 0;
    }

    // Get the year, month, day of the provided `date` *in the target timezone*
    // Since `parseDate` returns midnight in `timezone`, formatting it in `timezone` gives the correct Y/M/D.
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    const year = Number(parts.find(p => p.type === 'year')!.value);
    const month = Number(parts.find(p => p.type === 'month')!.value) - 1;
    const day = Number(parts.find(p => p.type === 'day')!.value);

    return createDateInTimezone(year, month, day, hour, minute, timezone);
}

// Redirect formatters to the timezone-aware utils in utils.time.ts
export function formatReminderDateTime(date: Date, timezone: string): string {
    return formatDateTimeForUser(date, timezone);
}

export function formatReminderDate(date: Date, timezone: string): string {
    return fDateUser(date, timezone);
}

export function formatReminderTime(date: Date, timezone: string): string {
    return fTimeUser(date, timezone);
}

export function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}
