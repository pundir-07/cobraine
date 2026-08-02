import {
    StateGraph,
    MessagesAnnotation,
    START,
    END,
    interrupt,
    Command,
} from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage } from '@langchain/core/messages';
import { checkpointer } from './checkpointer';
import { buildAgentTools } from './tools';
import { AskUserPayload } from './tools/tool.ask_user';
import { UserContext } from './state';
import { config } from '../config';
import { Attachment } from './types/types.agent.attachment';

export interface AgentGraphInput {
    messages: BaseMessage[];
    userContext: UserContext;
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

/**
 * Build and compile a stateful ReAct agent graph for a specific user session.
 *
 * Graph topology:
 *   START → agent → (toolsCondition) → tools → agent → ... → END
 *
 * Uses the explicit StateGraph API (not createReactAgent) for full control
 * over state, nodes, and edges. Custom state fields (userContext, attachments)
 * can be added here without fighting the prebuilt abstraction.
 */
function buildGraph(telegramId: number, chatId: number) {
    const llm = new ChatOpenAI({
        model: config.openrouter.defaultModel,
        apiKey: config.openrouter.apiKey,
        configuration: {
            baseURL: config.openrouter.baseUrl,
        },
        temperature: 0,
    });

    const tools = buildAgentTools(telegramId, chatId);
    const llmWithTools = llm.bindTools(tools);
    const toolNode = new ToolNode(tools);

    /** Agent node — calls the LLM with the current message history. */
    async function agentNode(state: typeof MessagesAnnotation.State) {
        const response = await llmWithTools.invoke(state.messages);
        return { messages: [response] };
    }

    const workflow = new StateGraph(MessagesAnnotation)
        .addNode('agent', agentNode)
        .addNode('tools', toolNode)
        .addEdge(START, 'agent')
        .addConditionalEdges('agent', toolsCondition)
        .addEdge('tools', 'agent');

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
export async function runAgentGraph(input: AgentGraphInput): Promise<AgentGraphOutput> {
    const { telegramId, chatId } = input.userContext;
    const graph = buildGraph(telegramId, chatId);

    const stream = await graph.stream(
        { messages: input.messages },
        { ...threadConfig(chatId), streamMode: 'values' },
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
): Promise<AgentGraphOutput> {
    const graph = buildGraph(telegramId, chatId);

    const stream = await graph.stream(
        new Command({ resume: answer }),
        { ...threadConfig(chatId), streamMode: 'values' },
    );

    return drainStream(stream);
}
