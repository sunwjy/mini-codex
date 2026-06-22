import type { AgentEvent } from '../core/events.js';

export interface CompactTranscriptInput {
  events: AgentEvent[];
  maxEvents?: number;
}

export interface CompactedTranscript {
  threadId: string;
  eventCount: number;
  omittedEventCount: number;
  summary: string;
  recentEvents: AgentEvent[];
}

/** Retains the newest events and derives a small, human-readable resume summary. */
export function compactTranscript(input: CompactTranscriptInput): CompactedTranscript {
  const maxEvents = input.maxEvents ?? 40;
  const [first] = input.events;

  if (!first) {
    throw new Error('Cannot compact an empty transcript');
  }

  const recentEvents = input.events.slice(-maxEvents);
  const omittedEventCount = Math.max(0, input.events.length - recentEvents.length);

  return {
    eventCount: input.events.length,
    omittedEventCount,
    recentEvents,
    summary: summarizeForResume(input.events, omittedEventCount),
    threadId: first.threadId,
  };
}

function summarizeForResume(events: AgentEvent[], omittedEventCount: number): string {
  // The summary intentionally captures only the latest turn outcomes, not arbitrary event data.
  const prompts = findStringData(events, 'turn.started', 'prompt');
  const completions = findStringData(events, 'turn.completed', 'finalMessage');
  const failures = findStringData(events, 'turn.failed', 'message');
  const parts = [
    `Transcript has ${events.length} events.`,
    omittedEventCount > 0
      ? `${omittedEventCount} older events were compacted.`
      : 'No events were compacted.',
  ];
  const lastPrompt = prompts.at(-1);
  const lastCompletion = completions.at(-1);
  const lastFailure = failures.at(-1);

  if (lastPrompt) {
    parts.push(`Last prompt: ${lastPrompt}`);
  }

  if (lastCompletion) {
    parts.push(`Last completion: ${lastCompletion}`);
  }

  if (lastFailure) {
    parts.push(`Last failure: ${lastFailure}`);
  }

  return parts.join(' ');
}

function findStringData(events: AgentEvent[], eventType: string, key: string): string[] {
  const values: string[] = [];

  for (const event of events) {
    if (event.type !== eventType || !isRecord(event.data)) {
      continue;
    }

    const value = event.data[key];
    if (typeof value === 'string') {
      values.push(value);
    }
  }

  return values;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
