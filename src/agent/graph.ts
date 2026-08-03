import {
    StateGraph,
    START,
    END,
    interrupt,
    Command,
} from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage } from '@langchain/core/messages';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { Serialized } from '@langchain/core/load/serializable';
import { checkpointer } from './checkpointer';
import { buildMainAgentTools, buildGoalAgentTools, buildAllTools } from './tools';
import { AskUserPayload } from './tools/tool.ask_user';
import { UserContext, StateAnnotation } from './state';
import { Attachment } from './types/types.agent.attachment';
import { buildGoalAgentNode } from './nodes/node.goalAgent';
import { buildMainAgentNode } from './nodes/node.mainAgent';

export interface AgentGraphInput {
    messages: BaseMessage[];
    userContext: UserContext;
    activeAgent?: string;
    /** Attachments extracted from the Telegram message, if any. */
    attachments?: Attachment[];
}

export interface AgentGraphResult {
    type: 'complete';
    content: string;
}

export interface AgentGraphInterrupt {
    type: 'interrupted';
    value: AskUserPayload;
}

export type AgentGraphOutput = AgentGraphResult | AgentGraphInterrupt;

class AgentLoggingCallbackHandler extends BaseCallbackHandler {
    name = 'AgentLoggingCallbackHandler';

    handleToolStart(tool: Serialized, input: string, runId: string, parentRunId?: string, tags?: string[], metadata?: Record<string, unknown>, name?: string) {
        const toolName = name || (tool as any).kwargs?.name || (tool as any).name || tool.id[tool.id.length - 1];
        console.log(`\n[🛠️  Tool Started] ${toolName}`);
        try {
            const parsed = JSON.parse(input);
            console.log(`    Input:`, parsed);
        } catch {
            console.log(`    Input: ${input}`);
        }
    }

    handleToolEnd(output: any) {
        let strOutput = '';
        if (typeof output === 'string') {
            strOutput = output;
        } else if (output && typeof output === 'object') {
            strOutput = output.content || JSON.stringify(output);
        } else {
            strOutput = String(output);
        }
        strOutput = strOutput.replace(/\n/g, ' ');
        const preview = strOutput.substring(0, 100);
        console.log(`[✅ Tool Success] ${preview}${strOutput.length > 100 ? '...' : ''}`);
    }

    handleToolError(err: any) {
        console.log(`[❌ Tool Error] ${err.message}`);
    }
}
const loggerCallback = new AgentLoggingCallbackHandler();

/**
 * Build and compile a stateful ReAct agent graph for a specific user session.
 *
 * Graph topology:
 *   START → [routeAgent] → (agent | goalAgent)
 *   (agent | goalAgent) → (toolsCondition) → tools
 *   tools → [routeAfterTools] → (agent | goalAgent)
 */
function buildGraph(telegramId: number, chatId: number, llm: ChatOpenAI) {
    const mainTools = buildMainAgentTools(telegramId, chatId);
    const goalTools = buildGoalAgentTools(telegramId, chatId);
    const allTools = buildAllTools(telegramId, chatId);
    
    const llmMain = llm.bindTools(mainTools);
    const llmGoal = llm.bindTools(goalTools);
    
    const toolNode = new ToolNode(allTools);
    
    const goalAgentNode = buildGoalAgentNode(llmGoal);
    const agentNode = buildMainAgentNode(llmMain);

    const routeAgent = (state: typeof StateAnnotation.State) => {
        const nextAgent = state.activeAgent === 'goalAgent' ? 'goalAgent' : 'agent';
        console.log(`\n[🔀 Router] Routing to: ${nextAgent === 'agent' ? 'Main Agent' : 'Goal Agent'}`);
        return nextAgent;
    };

    const workflow = new StateGraph(StateAnnotation)
        .addNode('agent', agentNode)
        .addNode('goalAgent', goalAgentNode)
        .addNode('tools', toolNode)
        .addConditionalEdges(START, routeAgent, {
            agent: 'agent',
            goalAgent: 'goalAgent',
        })
        .addConditionalEdges('agent', toolsCondition)
        .addConditionalEdges('goalAgent', toolsCondition)
        .addConditionalEdges('tools', routeAgent, {
            agent: 'agent',
            goalAgent: 'goalAgent',
        });

    return workflow.compile({ checkpointer });
}

/** Thread config — maps Telegram chatId to a LangGraph persistence thread. */
const threadConfig = (chatId: number) => ({
    configurable: { thread_id: String(chatId) },
});

function extractContent(messages: BaseMessage[]): string {
    const last = messages[messages.length - 1];
    if (!last) return '';
    return typeof last.content === 'string'
        ? last.content
        : JSON.stringify(last.content);
}

/**
 * Drain a graph stream, collecting the last message state.
 * Detects interrupt() payloads and returns early when encountered.
 */
async function drainStream(
    stream: AsyncIterable<any>,
): Promise<AgentGraphOutput> {
    let lastMessages: BaseMessage[] = [];

    for await (const chunk of stream) {
        // interrupt() surfaces under __interrupt__ in each streamed state snapshot
        const interrupts: Array<{ value: unknown }> | undefined = (chunk as any).__interrupt__;
        if (Array.isArray(interrupts) && interrupts.length > 0) {
            return { type: 'interrupted', value: interrupts[0].value as AskUserPayload };
        }
        if (chunk.messages) {
            lastMessages = chunk.messages;
        }
    }

    return { type: 'complete', content: extractContent(lastMessages) };
}

/**
 * Start (or continue a non-interrupted) agent graph invocation.
 * Returns either the final assistant response or an interrupt payload.
 */
export async function runAgentGraph(input: AgentGraphInput, llm: ChatOpenAI): Promise<AgentGraphOutput> {
    const { telegramId, chatId } = input.userContext;
    const graph = buildGraph(telegramId, chatId, llm);

    const stream = await graph.stream(
        { 
            messages: input.messages, 
            userContext: input.userContext,
            ...(input.activeAgent ? { activeAgent: input.activeAgent } : {})
        },
        { ...threadConfig(chatId), streamMode: 'values', callbacks: [loggerCallback] },
    );

    return drainStream(stream);
}

/**
 * Resume a previously interrupted agent graph thread with the user's answer.
 * The checkpointer restores the paused state and the graph continues from there.
 */
export async function resumeAgentGraph(
    telegramId: number,
    chatId: number,
    answer: string,
    llm: ChatOpenAI,
): Promise<AgentGraphOutput> {
    const graph = buildGraph(telegramId, chatId, llm);

    const stream = await graph.stream(
        new Command({ resume: answer }),
        { ...threadConfig(chatId), streamMode: 'values', callbacks: [loggerCallback] },
    );

    return drainStream(stream);
}
