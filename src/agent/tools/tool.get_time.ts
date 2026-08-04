import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { UserService } from '../../services/service.user';
import { getTimeContext, formatTimeContextForLLM, TIMEZONE_UNSET } from '../../utils/utils.time';

export const getTimeTool = (userId: number) =>
    tool(
        async () => {
            const user = await UserService.getUserByTelegramId(userId);
            const timezone = user?.timezone ?? TIMEZONE_UNSET;

            if (timezone === TIMEZONE_UNSET) {
                return `CRITICAL INSTRUCTION: The user's timezone is not configured (user timezone = 'UNSET'). Before you can set any reminders or answer time-related questions, you MUST ask the user what timezone they are in (e.g. "Which city or timezone are you in?"). Once they reply, use the \`set_user_timezone\` tool to save it. DO NOT assume their timezone.`;
            }

            const timeCtx = getTimeContext(timezone);
            if (!timeCtx) return 'Error: Could not determine time context.';

            return formatTimeContextForLLM(timeCtx);
        },
        {
            name: 'get_time',
            description:
                'Get the current date, time, and timezone of the user. You MUST use this tool mandatorily for all temporal understanding of "now", "today", "tomorrow", "yesterday", or when scheduling reminders.',
            schema: z.object({}),
        },
    );
