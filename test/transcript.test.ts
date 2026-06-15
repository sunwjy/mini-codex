import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEvent } from '../src/core/events.js';
import {
  JsonlTranscriptStore,
  TranscriptParseError,
  TranscriptSchemaError,
} from '../src/transcript/jsonl-store.js';

describe('JsonlTranscriptStore', () => {
  it('writes a schema event and round-trips appended events', async () => {
    const store = new JsonlTranscriptStore({ directory: await tempDirectory() });
    await store.initialize('thread-1');

    await store.append(
      createEvent({
        idFactory: () => 'event-1',
        now: () => new Date('2026-06-15T00:00:00.000Z'),
        threadId: 'thread-1',
        turnId: 'turn-1',
        type: 'turn.started',
      }),
    );

    const events = await store.read('thread-1');

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: 'transcript.schema',
      threadId: 'thread-1',
      data: { schemaVersion: 1 },
    });
    expect(events[1]).toMatchObject({
      id: 'event-1',
      type: 'turn.started',
      threadId: 'thread-1',
      turnId: 'turn-1',
    });
  });

  it('throws an explicit parse error for corrupt transcript lines', async () => {
    const directory = await tempDirectory();
    await writeFile(join(directory, 'thread-1.jsonl'), '{"type":\n');

    const store = new JsonlTranscriptStore({ directory });

    await expect(store.read('thread-1')).rejects.toBeInstanceOf(TranscriptParseError);
  });

  it('throws an explicit schema error for incompatible versions', async () => {
    const directory = await tempDirectory();
    const schemaEvent = {
      id: 'schema',
      type: 'transcript.schema',
      timestamp: '2026-06-15T00:00:00.000Z',
      threadId: 'thread-1',
      data: { schemaVersion: 999 },
    };
    await writeFile(join(directory, 'thread-1.jsonl'), `${JSON.stringify(schemaEvent)}\n`);

    const store = new JsonlTranscriptStore({ directory });

    await expect(store.read('thread-1')).rejects.toBeInstanceOf(TranscriptSchemaError);
  });
});

async function tempDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'mini-codex-transcript-'));
}
