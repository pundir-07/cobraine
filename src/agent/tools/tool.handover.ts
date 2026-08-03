import { tool } from '@langchain/core/tools';
import { Command } from '@langchain/langgraph';
import { z } from 'zod';

export const handoverToPlannerTool = tool(
    async () => {
        return new Command({
            update: { activeAgent: 'goalAgent' },
            goto: 'goalAgent',
        });
    },
    {
        name: 'handover_to_planner',
        description:
            'Use this tool when the user intends to create a goal, plan, daily routine, or schedule a series of milestone reminders. This will hand over control to the Goal Coach Agent.',
        schema: z.object({}),
    },
);

export const handoverToMainAgentTool = tool(
    async () => {
        return new Command({
            update: { activeAgent: 'agent' },
            goto: 'agent',
        });
    },
    {
        name: 'handover_to_main_agent',
        description:
            'Use this tool when you have finished setting up a goal/plan or if the user asks a general question that is unrelated to goal planning. This hands control back to the general assistant.',
        schema: z.object({}),
    },
);
