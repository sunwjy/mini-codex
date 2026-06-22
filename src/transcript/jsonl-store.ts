import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type AgentEvent,
  createTranscriptSchemaEvent,
  TRANSCRIPT_SCHEMA_VERSION,
} from '../core/events.js';

export class TranscriptParseError extends Error {
  constructor(
    readonly transcriptPath: string,
    readonly lineNumber: number,
    cause: unknown,
  ) {
    super(`Failed to parse transcript ${transcriptPath} at line ${lineNumber}`);
    this.name = 'TranscriptParseError';
    this.cause = cause;
  }
}

export class TranscriptSchemaError extends Error {
  constructor(
    readonly transcriptPath: string,
    message: string,
  ) {
    super(`${transcriptPath}: ${message}`);
    this.name = 'TranscriptSchemaError';
  }
}

export interface JsonlTranscriptStoreOptions {
  directory: string;
}

/** Persists append-only agent event streams as one JSON object per line. */
export class JsonlTranscriptStore {
  readonly directory: string;

  constructor(options: JsonlTranscriptStoreOptions) {
    this.directory = options.directory;
  }

  async initialize(threadId: string): Promise<string> {
    await mkdir(this.directory, { recursive: true });
    const path = this.pathForThread(threadId);
    const schemaEvent = createTranscriptSchemaEvent(threadId);

    try {
      // Exclusive creation prevents concurrent initializers from replacing an existing transcript.
      await writeFile(path, `${JSON.stringify(schemaEvent)}\n`, { flag: 'wx' });
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }

      // An existing file is reusable only when it is parseable and schema-compatible.
      await this.read(threadId);
    }

    return path;
  }

  async append(event: AgentEvent): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await appendFile(this.pathForThread(event.threadId), `${JSON.stringify(event)}\n`);
  }

  async read(threadId: string): Promise<AgentEvent[]> {
    const path = this.pathForThread(threadId);
    const content = await readFile(path, 'utf8');
    const events = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line, index) => parseLine(path, index + 1, line));

    assertCompatibleSchema(path, events);

    return events;
  }

  pathForThread(threadId: string): string {
    assertSafeThreadId(threadId);
    return join(this.directory, `${threadId}.jsonl`);
  }
}

function parseLine(path: string, lineNumber: number, line: string): AgentEvent {
  try {
    const parsed = JSON.parse(line);
    if (!isAgentEvent(parsed)) {
      throw new Error('line is not an AgentEvent object');
    }

    return parsed;
  } catch (error) {
    throw new TranscriptParseError(path, lineNumber, error);
  }
}

function assertCompatibleSchema(path: string, events: AgentEvent[]): void {
  const [first] = events;

  if (first?.type !== 'transcript.schema') {
    throw new TranscriptSchemaError(path, 'missing transcript schema event');
  }

  const schemaVersion = readSchemaVersion(first);

  if (schemaVersion !== TRANSCRIPT_SCHEMA_VERSION) {
    throw new TranscriptSchemaError(path, `unsupported transcript schema version ${schemaVersion}`);
  }
}

function readSchemaVersion(event: AgentEvent): unknown {
  if (!isRecord(event.data)) {
    return undefined;
  }

  return event.data.schemaVersion;
}

function isAgentEvent(value: unknown): value is AgentEvent {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.timestamp === 'string' &&
    typeof value.threadId === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'EEXIST'
  );
}

function assertSafeThreadId(threadId: string): void {
  // Thread identifiers become filenames, so separators and control characters are forbidden.
  if (!/^[a-zA-Z0-9._:-]+$/.test(threadId)) {
    throw new Error(`Unsafe thread id: ${threadId}`);
  }
}
