import { readdir } from 'node:fs/promises';
import type { AgentEvent } from '../core/events.js';
import type { JsonlTranscriptStore } from '../transcript/jsonl-store.js';

export type ThreadRunStatus = 'completed' | 'failed' | 'running' | 'unknown';

export interface ThreadStatus {
  threadId: string;
  status: ThreadRunStatus;
  eventCount: number;
  turnCount: number;
  lastEventType: string;
  lastUpdatedAt: string;
  lastPrompt?: string;
  finalMessage?: string;
}

export async function readThreadStatus(
  store: JsonlTranscriptStore,
  threadId: string,
): Promise<ThreadStatus> {
  return summarizeThreadEvents(await store.read(threadId));
}

export async function listThreadStatuses(store: JsonlTranscriptStore): Promise<ThreadStatus[]> {
  let fileNames: string[];

  try {
    fileNames = await readdir(store.directory);
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }

    throw error;
  }

  const threadIds = fileNames
    .filter((fileName) => fileName.endsWith('.jsonl'))
    .map((fileName) => fileName.slice(0, -'.jsonl'.length))
    .sort();
  const statuses: ThreadStatus[] = [];

  for (const threadId of threadIds) {
    statuses.push(await readThreadStatus(store, threadId));
  }

  return statuses;
}

export function summarizeThreadEvents(events: AgentEvent[]): ThreadStatus {
  const [first] = events;
  const last = events.at(-1);

  if (!first || !last) {
    throw new Error('Cannot summarize an empty transcript');
  }

  const status = statusFromLastEvent(last);
  const base: ThreadStatus = {
    eventCount: events.length,
    lastEventType: last.type,
    lastUpdatedAt: last.timestamp,
    status,
    threadId: first.threadId,
    turnCount: events.filter((event) => event.type === 'turn.started').length,
  };
  const lastPrompt = findLastStringData(events, 'turn.started', 'prompt');
  const finalMessage = findLastStringData(events, 'turn.completed', 'finalMessage');

  return {
    ...base,
    ...(lastPrompt === undefined ? {} : { lastPrompt }),
    ...(finalMessage === undefined ? {} : { finalMessage }),
  };
}

function statusFromLastEvent(event: AgentEvent): ThreadRunStatus {
  if (event.type === 'turn.completed') {
    return 'completed';
  }

  if (event.type === 'turn.failed') {
    return 'failed';
  }

  if (event.type === 'agent.message.delta' || event.type === 'turn.started') {
    return 'running';
  }

  return 'unknown';
}

function findLastStringData(
  events: AgentEvent[],
  eventType: string,
  key: string,
): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];

    if (event?.type !== eventType || !isRecord(event.data)) {
      continue;
    }

    const value = event.data[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
