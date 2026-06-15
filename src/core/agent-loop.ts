import type { ModelMessage, ModelProvider } from '../model/types.js';
import type { JsonlTranscriptStore } from '../transcript/jsonl-store.js';
import { type AgentEvent, createEvent } from './events.js';

export interface AgentLoopOptions {
  model: ModelProvider;
  transcriptStore: JsonlTranscriptStore;
  idFactory?: () => string;
  now?: () => Date;
}

export interface RunAgentTurnInput {
  threadId: string;
  turnId: string;
  prompt: string;
  systemPrompt?: string;
}

export interface RunAgentTurnResult {
  finalMessage: string;
  events: AgentEvent[];
}

export class AgentLoop {
  readonly model: ModelProvider;
  readonly transcriptStore: JsonlTranscriptStore;
  readonly idFactory: (() => string) | undefined;
  readonly now: (() => Date) | undefined;

  constructor(options: AgentLoopOptions) {
    this.model = options.model;
    this.transcriptStore = options.transcriptStore;
    this.idFactory = options.idFactory;
    this.now = options.now;
  }

  async runTurn(input: RunAgentTurnInput): Promise<RunAgentTurnResult> {
    await this.transcriptStore.initialize(input.threadId);

    const events: AgentEvent[] = [];
    const append = async (event: AgentEvent): Promise<void> => {
      events.push(event);
      await this.transcriptStore.append(event);
    };

    await append(this.createEvent({ threadId: input.threadId, type: 'thread.started' }));
    await append(
      this.createEvent({
        data: { prompt: input.prompt },
        threadId: input.threadId,
        turnId: input.turnId,
        type: 'turn.started',
      }),
    );

    const messages = buildMessages(input);
    let finalMessage = '';

    try {
      for await (const streamEvent of this.model.stream({ messages })) {
        if (streamEvent.type === 'text.delta') {
          finalMessage += streamEvent.delta;
          await append(
            this.createEvent({
              data: { delta: streamEvent.delta },
              threadId: input.threadId,
              turnId: input.turnId,
              type: 'agent.message.delta',
            }),
          );
        }

        if (streamEvent.type === 'message.completed') {
          finalMessage = streamEvent.content;
        }
      }

      await append(
        this.createEvent({
          data: { finalMessage },
          threadId: input.threadId,
          turnId: input.turnId,
          type: 'turn.completed',
        }),
      );

      return { events, finalMessage };
    } catch (error) {
      await append(
        this.createEvent({
          data: {
            message: error instanceof Error ? error.message : String(error),
          },
          threadId: input.threadId,
          turnId: input.turnId,
          type: 'turn.failed',
        }),
      );

      throw error;
    }
  }

  private createEvent(input: Parameters<typeof createEvent>[0]): AgentEvent {
    return createEvent({
      ...input,
      ...(this.idFactory ? { idFactory: this.idFactory } : {}),
      ...(this.now ? { now: this.now } : {}),
    });
  }
}

function buildMessages(input: RunAgentTurnInput): ModelMessage[] {
  const messages: ModelMessage[] = [];

  if (input.systemPrompt) {
    messages.push({ content: input.systemPrompt, role: 'system' });
  }

  messages.push({ content: input.prompt, role: 'user' });

  return messages;
}
