import { randomUUID } from 'node:crypto';

/** Version written into new transcript schema events. */
export const TRANSCRIPT_SCHEMA_VERSION = 1;

/** Event names that can be persisted in an agent transcript. */
export type AgentEventType =
  | 'transcript.schema'
  | 'thread.started'
  | 'turn.started'
  | 'turn.completed'
  | 'turn.failed'
  | 'item.started'
  | 'item.completed'
  | 'agent.message.delta'
  | 'tool.call.started'
  | 'tool.call.completed'
  | 'tool.call.failed';

/** Common envelope for all transcript events. */
export interface AgentEvent<TData = unknown> {
  id: string;
  type: AgentEventType;
  timestamp: string;
  threadId: string;
  turnId?: string;
  itemId?: string;
  data?: TData;
}

/** Payload that declares the transcript serialization schema. */
export interface TranscriptSchemaData {
  schemaVersion: number;
}

/** Discriminated event written at the start of each transcript. */
export type TranscriptSchemaEvent = AgentEvent<TranscriptSchemaData> & {
  type: 'transcript.schema';
};

/** Inputs for creating a non-schema transcript event. */
export interface CreateEventInput<TData = unknown> {
  type: Exclude<AgentEventType, 'transcript.schema'>;
  threadId: string;
  turnId?: string;
  itemId?: string;
  data?: TData;
  idFactory?: () => string;
  now?: () => Date;
}

/** Creates a timestamped transcript event with injectable deterministic values for tests. */
export function createEvent<TData = unknown>(input: CreateEventInput<TData>): AgentEvent<TData> {
  const event: AgentEvent<TData> = {
    id: input.idFactory?.() ?? randomUUID(),
    type: input.type,
    timestamp: (input.now?.() ?? new Date()).toISOString(),
    threadId: input.threadId,
  };

  if (input.turnId !== undefined) {
    event.turnId = input.turnId;
  }

  if (input.itemId !== undefined) {
    event.itemId = input.itemId;
  }

  if (input.data !== undefined) {
    event.data = input.data;
  }

  return event;
}

/** Creates the schema marker that initializes a transcript. */
export function createTranscriptSchemaEvent(
  threadId: string,
  options: Pick<CreateEventInput, 'idFactory' | 'now'> = {},
): TranscriptSchemaEvent {
  return {
    id: options.idFactory?.() ?? randomUUID(),
    type: 'transcript.schema',
    timestamp: (options.now?.() ?? new Date()).toISOString(),
    threadId,
    data: {
      schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
    },
  };
}
