import { tool } from '@langchain/core/tools';
import { interrupt } from '@langchain/langgraph';
import { z } from 'zod';

export interface AskUserPayload {
    question: string;
    options?: string[];
}

/**
 * When the agent needs clarification from the user, it calls this tool.
 * LangGraph's interrupt() pauses graph execution and surfaces the payload
 * to the orchestrator layer, which sends the question to Telegram.
 * The graph resumes when the orchestrator calls graph.invoke({ resume: answer }).
 */
export const askUserTool = tool(
    async ({ question, options }): Promise<string> => {
        const payload: AskUserPayload = { question, options };
        // interrupt() throws NodeInterrupt — LangGraph catches it, persists state,
        // and returns the payload as the interrupt value to the caller.
        const answer = interrupt(payload);
        return String(answer);
    },
    {
        name: 'ask_user',
        description:
            'Ask the user a clarifying question when information is ambiguous or missing. Optionally provide a list of options for the user to choose from. The graph will pause until the user answers.',
        schema: z.object({
            question: z.string().describe('The question to ask the user.'),
            options: z
                .array(z.string())
                .optional()
                .describe(
                    'Optional list of choices to present as an inline keyboard. Omit for a free-text reply.',
                ),
        }),
    },
);
