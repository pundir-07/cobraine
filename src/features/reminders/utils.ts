const MONTHS: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
};

export function parseDate(input: string): Date | null {
    input = input.trim().toLowerCase();

    const now = new Date();
    let day: number;
    let month: number;
    let year = now.getFullYear();

    // 25/12 or 25/12/2026
    let m = input.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);

    if (m) {
        day = Number(m[1]);
        month = Number(m[2]) - 1;

        if (m[3]) year = Number(m[3]);
    }

    // 25 Dec
    else {
        m = input.match(/^(\d{1,2})\s+([a-z]{3})$/);

        if (!m) return null;

        day = Number(m[1]);

        if (!(m[2] in MONTHS)) return null;

        month = MONTHS[m[2]];
    }

    const date = new Date(year, month, day);

    // Reject invalid dates like 31/02
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
    ) {
        return null;
    }

    // If year wasn't supplied and the date has already passed,
    // schedule it for next year.
    if (!m?.[3] && date < now) {
        date.setFullYear(year + 1);
    }

    return date;
}
export function parseTime(input: string, date: Date): Date | null {
    input = input.trim().toLowerCase();

    let hour: number;
    let minute: number;

    // 21:30
    let m = input.match(/^(\d{1,2}):(\d{2})$/);

    if (m) {
        hour = Number(m[1]);
        minute = Number(m[2]);

        if (hour > 23 || minute > 59) return null;
    }

    // 9am / 9:30pm
    else {
        m = input.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);

        if (!m) return null;

        hour = Number(m[1]);
        minute = Number(m[2] ?? 0);

        if (hour < 1 || hour > 12 || minute > 59) return null;

        if (m[3] === "pm" && hour !== 12) hour += 12;
        if (m[3] === "am" && hour === 12) hour = 0;
    }

    const result = new Date(date);

    result.setHours(hour, minute, 0, 0);

    return result;
}