import type { JsonlTranscriptStore } from '../transcript/jsonl-store.js';
import { type CompactedTranscript, compactTranscript } from './compact.js';
import { summarizeThreadEvents, type ThreadStatus } from './status.js';

export interface ResumeThreadInput {
  store: JsonlTranscriptStore;
  threadId: string;
  maxEvents?: number;
}

export interface ResumeThreadResult {
  status: ThreadStatus;
  compacted: CompactedTranscript;
}

/** Loads a persisted thread and returns both its current status and resume context. */
export async function resumeThread(input: ResumeThreadInput): Promise<ResumeThreadResult> {
  const events = await input.store.read(input.threadId);

  return {
    compacted: compactTranscript({
      events,
      ...(input.maxEvents === undefined ? {} : { maxEvents: input.maxEvents }),
    }),
    status: summarizeThreadEvents(events),
  };
}
