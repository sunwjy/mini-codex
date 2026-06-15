import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentLoop } from '../src/core/agent-loop.js';
import { FakeModelProvider } from '../src/model/fake-model.js';
import { JsonlTranscriptStore } from '../src/transcript/jsonl-store.js';

describe('AgentLoop', () => {
  it('streams fake model output into transcript events', async () => {
    const loop = createLoop(new FakeModelProvider({ chunks: ['hello', ' world'] }));

    const result = await loop.runTurn({
      prompt: 'Say hello',
      threadId: 'thread-1',
      turnId: 'turn-1',
    });

    expect(result.finalMessage).toBe('hello world');
    expect(result.events.map((event) => event.type)).toEqual([
      'thread.started',
      'turn.started',
      'agent.message.delta',
      'agent.message.delta',
      'turn.completed',
    ]);

    const transcriptEvents = await loop.transcriptStore.read('thread-1');
    expect(transcriptEvents.map((event) => event.type)).toEqual([
      'transcript.schema',
      'thread.started',
      'turn.started',
      'agent.message.delta',
      'agent.message.delta',
      'turn.completed',
    ]);
  });

  it('records turn failure events before rethrowing model errors', async () => {
    const loop = createLoop(new FakeModelProvider({ error: new Error('model failed') }));

    await expect(
      loop.runTurn({
        prompt: 'Fail',
        threadId: 'thread-2',
        turnId: 'turn-2',
      }),
    ).rejects.toThrow('model failed');

    const transcriptEvents = await loop.transcriptStore.read('thread-2');
    expect(transcriptEvents.at(-1)).toMatchObject({
      data: { message: 'model failed' },
      type: 'turn.failed',
    });
  });
});

function createLoop(model: FakeModelProvider): AgentLoop {
  let nextId = 0;

  return new AgentLoop({
    idFactory: () => `event-${++nextId}`,
    model,
    now: () => new Date('2026-06-15T00:00:00.000Z'),
    transcriptStore: new JsonlTranscriptStore({
      directory: join(tmpdir(), `mini-codex-agent-loop-${randomUUID()}`),
    }),
  });
}
