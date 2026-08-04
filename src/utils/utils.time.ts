/**
 * Timezone-aware time utilities.
 *
 * Provides a canonical TimeContext (UTC + user-local) for LLM prompts,
 * and display formatters that always respect the user's IANA timezone.
 *
 * All conversions use Intl.DateTimeFormat — no manual offset arithmetic.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeContext {
    /** ISO 8601 UTC timestamp, e.g. "2026-08-04T07:43:35Z" */
    utcNow: string;
    /** IANA timezone identifier, e.g. "Asia/Kolkata" */
    userTimezone: string;
    /** ISO-like local timestamp with offset, e.g. "2026-08-04T13:13:35+05:30" */
    userLocalTime: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sentinel stored in the DB when the user hasn't set a timezone yet. */
export const TIMEZONE_UNSET = 'UNSET';

// ---------------------------------------------------------------------------
// Core builders
// ---------------------------------------------------------------------------

/**
 * Build a TimeContext for the given IANA timezone.
 * Returns `null` if the timezone is the UNSET sentinel.
 */
export function getTimeContext(userTimezone: string): TimeContext | null {
    if (userTimezone === TIMEZONE_UNSET) return null;

    const now = new Date();

    return {
        utcNow: now.toISOString().replace(/\.\d{3}Z$/, 'Z'), // strip ms
        userTimezone,
        userLocalTime: toLocalISOString(now, userTimezone),
    };
}

/**
 * Format a TimeContext into the structured block injected into LLM prompts.
 *
 * Output format:
 *   Current UTC time:
 *   2026-08-04T07:43:35Z
 *
 *   User timezone:
 *   Asia/Kolkata
 *
 *   Current user local time:
 *   2026-08-04T13:13:35+05:30
 */
export function _formatTimeContextForLLM(ctx: TimeContext): string {
    return [
        `Current UTC time:`,
        ctx.utcNow,
        ``,
        `User timezone:`,
        ctx.userTimezone,
        ``,
        `Current user local time:`,
        ctx.userLocalTime,
    ].join('\n');
}
export function formatTimeContextForLLM(ctx: TimeContext): string {
    return `## CURRENT TIME

The current local date and time is:
${ctx.userLocalTime}

Timezone:
${ctx.userTimezone}

This timestamp is authoritative.
Always use it when calculating reminders, durations, "today", "tomorrow", or relative times.
Ignore any internal knowledge of the current date or time.`
}

// ---------------------------------------------------------------------------
// Display formatters (for Telegram messages, tool responses, etc.)
// ---------------------------------------------------------------------------

/** e.g. "4 Aug 2026 at 1:13 pm" */
export function formatDateTimeForUser(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone,
    }).format(date);
}

/** e.g. "4 Aug 2026" */
export function formatDateForUser(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeZone: timezone,
    }).format(date);
}

/** e.g. "1:13 pm" */
export function formatTimeForUser(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-IN', {
        timeStyle: 'short',
        timeZone: timezone,
    }).format(date);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Produce an ISO-like string with the correct UTC offset for the given timezone.
 * e.g. "2026-08-04T13:13:35+05:30"
 *
 * Uses Intl.DateTimeFormat to extract date parts in the target timezone,
 * then calculates the UTC offset from the difference.
 */
function toLocalISOString(date: Date, timezone: string): string {
    // Extract individual parts in the target timezone
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const get = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value ?? '00';

    const localStr = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;

    // Calculate offset: local epoch minus UTC epoch
    // Build a Date from the local parts (interpreted as UTC) then compare
    const localAsUTC = new Date(`${localStr}Z`);
    const offsetMs = localAsUTC.getTime() - date.getTime();
    const offsetMin = Math.round(offsetMs / 60_000);

    const sign = offsetMin >= 0 ? '+' : '-';
    const absMin = Math.abs(offsetMin);
    const hh = String(Math.floor(absMin / 60)).padStart(2, '0');
    const mm = String(absMin % 60).padStart(2, '0');

    return `${localStr}${sign}${hh}:${mm}`;
}
