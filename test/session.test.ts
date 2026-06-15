import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEvent } from '../src/core/events.js';
import { compactTranscript, listThreadStatuses, resumeThread } from '../src/session/index.js';
import { JsonlTranscriptStore } from '../src/transcript/jsonl-store.js';

describe('session status and resume', () => {
  it('summarizes transcript status and resume compaction', async () => {
    const store = await fixtureStore();
    await writeCompletedTurn(store, 'thread-1');

    const [status] = await listThreadStatuses(store);

    expect(status).toMatchObject({
      eventCount: 5,
      finalMessage: 'done',
      lastPrompt: 'inspect',
      status: 'completed',
      threadId: 'thread-1',
      turnCount: 1,
    });

    const resumed = await resumeThread({ maxEvents: 2, store, threadId: 'thread-1' });

    expect(resumed.status.status).toBe('completed');
    expect(resumed.compacted.omittedEventCount).toBe(3);
    expect(resumed.compacted.summary).toContain('Last prompt: inspect');
    expect(resumed.compacted.recentEvents).toHaveLength(2);
  });

  it('compacts transcript events without omitting small transcripts', async () => {
    const store = await fixtureStore();
    await writeCompletedTurn(store, 'thread-2');

    const compacted = compactTranscript({
      events: await store.read('thread-2'),
      maxEvents: 10,
    });

    expect(compacted.omittedEventCount).toBe(0);
    expect(compacted.summary).toContain('No events were compacted');
  });
});

async function fixtureStore(): Promise<JsonlTranscriptStore> {
  const root = join(tmpdir(), `mini-codex-session-${randomUUID()}`);

  await mkdir(root, { recursive: true });

  return new JsonlTranscriptStore({ directory: root });
}

async function writeCompletedTurn(store: JsonlTranscriptStore, threadId: string): Promise<void> {
  await store.initialize(threadId);
  await store.append(
    createEvent({
      threadId,
      type: 'thread.started',
    }),
  );
  await store.append(
    createEvent({
      data: { prompt: 'inspect' },
      threadId,
      turnId: 'turn-1',
      type: 'turn.started',
    }),
  );
  await store.append(
    createEvent({
      data: { delta: 'do' },
      threadId,
      turnId: 'turn-1',
      type: 'agent.message.delta',
    }),
  );
  await store.append(
    createEvent({
      data: { finalMessage: 'done' },
      threadId,
      turnId: 'turn-1',
      type: 'turn.completed',
    }),
  );
}
