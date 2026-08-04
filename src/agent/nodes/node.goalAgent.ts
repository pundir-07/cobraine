import { Runnable } from '@langchain/core/runnables';
import { StateAnnotation } from '../state';
import { SystemMessage } from '@langchain/core/messages';
import { getTimeContext, formatTimeContextForLLM, TIMEZONE_UNSET } from '../../utils/utils.time';
import { UserService } from '../../services/service.user';

const GOAL_COACH_SYSTEM_PROMPT = `You are a strict but deeply empathetic Goal Coach Agent. 
Your primary job is to help the user set clear, actionable, and realistic goals, plans, and milestones (checkpoints). 

CRITICAL INSTRUCTIONS:
1. NEVER create a plan or schedule reminders immediately when a user asks.
2. FIRST, extensively discuss the user's objectives. Ask probing questions:
   - What is the underlying motivation for this goal?
   - What are the potential blockers or challenges?
   - What is a realistic timeline?
3. ONLY AFTER you have a solid understanding of the objectives, blockers, and timelines should you proceed to finalize the goal.
4. To finalize, use the \`create_plan\` tool, then use \`create_checkpoint\` for each milestone, and finally use \`set_reminder\` to schedule reminders for those checkpoints.
5. Remind the user that they will receive reminders for their checkpoints, which they must mark as Done or Snooze.
6. When invoked to provide feedback (e.g., when a user marks a milestone as Done or Snoozed), respond directly based on the context. If they snoozed, be pushy and remind them not to stall. If they completed it, be highly motivational.
7. CRITICAL: Once you have successfully finalized the plan and scheduled reminders, or if the user pivots to an unrelated topic, YOU MUST use the \`handover_to_main_agent\` tool to return control to the main assistant.`;

export function buildGoalAgentNode(llmWithTools: Runnable<any, any>) {
    return async function goalAgentNode(state: typeof StateAnnotation.State) {
        console.log('\n[🎯 Agent] Running Goal Agent...');
        const messages = state.messages;
        
        const user = await UserService.getUserByTelegramId(state.userContext.telegramId);
        const timezone = user?.timezone ?? TIMEZONE_UNSET;

        let environmentDetails = '';
        if (timezone === TIMEZONE_UNSET) {
            environmentDetails = `\n\nCRITICAL INSTRUCTION: The user's timezone is not configured.
Before you can set any reminders, you MUST ask the user what timezone they are in (e.g. "Which city or timezone are you in?").
Once they reply, immediately use the \`set_user_timezone\` tool to save it. DO NOT assume their timezone.`;
        } else {
            const timeCtx = getTimeContext(timezone);
            if (timeCtx) {
                environmentDetails = `\n\nYou need to refer to these environment details to help the user.\n${formatTimeContextForLLM(timeCtx)}`;
            }
        }
        
        // Inject the system prompt if it's not already there
        const systemMessage = new SystemMessage(GOAL_COACH_SYSTEM_PROMPT + environmentDetails);
        const messagesWithSystem = [systemMessage, ...messages];

        const response = await llmWithTools.invoke(messagesWithSystem);
        return { messages: [response] };
    };
}
