import type { Command } from 'commander';
import { loadMiniCodexConfig, resolveConfiguredTranscriptDir } from '../config/config.js';
import { listThreadStatuses, resumeThread } from '../session/index.js';
import { JsonlTranscriptStore } from '../transcript/jsonl-store.js';

/** Registers commands for inspecting, resuming, and compacting transcript sessions. */
export function addSessionCommands(program: Command): void {
  program
    .command('status')
    .description('show transcript status')
    .option('--workspace <path>', 'workspace root', process.cwd())
    .option('--config <path>', 'config file path inside the workspace')
    .option('--transcripts <path>', 'transcript directory inside the workspace')
    .option('--json', 'print JSON output')
    .action(async (options: SessionCommandOptions) => {
      const store = await createTranscriptStore(options);
      const statuses = await listThreadStatuses(store);

      // JSON mode is machine-readable and bypasses all human-oriented empty-state formatting.
      if (options.json) {
        console.log(JSON.stringify(statuses, null, 2));
        return;
      }

      if (statuses.length === 0) {
        console.log('No transcripts found.');
        return;
      }

      for (const status of statuses) {
        console.log(
          `${status.threadId} ${status.status} turns=${status.turnCount} events=${status.eventCount} updated=${status.lastUpdatedAt}`,
        );
      }
    });

  program
    .command('resume <threadId>')
    .description('summarize a transcript for resume')
    .option('--workspace <path>', 'workspace root', process.cwd())
    .option('--config <path>', 'config file path inside the workspace')
    .option('--transcripts <path>', 'transcript directory inside the workspace')
    .option('--max-events <count>', 'number of recent events to keep')
    .option('--json', 'print JSON output')
    .action(async (threadId: string, options: SessionCommandOptions) => {
      const store = await createTranscriptStore(options);
      const maxEvents = parseOptionalPositiveInteger(options.maxEvents, '--max-events');
      const resumed = await resumeThread({
        ...(maxEvents === undefined ? {} : { maxEvents }),
        store,
        threadId,
      });

      // Keep the structured result intact for scripts instead of rendering a prose summary.
      if (options.json) {
        console.log(JSON.stringify(resumed, null, 2));
        return;
      }

      console.log(`${resumed.status.threadId} ${resumed.status.status}`);
      console.log(resumed.compacted.summary);
    });

  program
    .command('compact <threadId>')
    .description('print compacted transcript context')
    .option('--workspace <path>', 'workspace root', process.cwd())
    .option('--config <path>', 'config file path inside the workspace')
    .option('--transcripts <path>', 'transcript directory inside the workspace')
    .option('--max-events <count>', 'number of recent events to keep')
    .option('--json', 'print JSON output')
    .action(async (threadId: string, options: SessionCommandOptions) => {
      const store = await createTranscriptStore(options);
      const maxEvents = parseOptionalPositiveInteger(options.maxEvents, '--max-events');
      const resumed = await resumeThread({
        ...(maxEvents === undefined ? {} : { maxEvents }),
        store,
        threadId,
      });

      // Compact JSON output exposes the same data used by the human-readable summary below.
      if (options.json) {
        console.log(JSON.stringify(resumed.compacted, null, 2));
        return;
      }

      console.log(resumed.compacted.summary);
      for (const event of resumed.compacted.recentEvents) {
        console.log(`${event.timestamp} ${event.type}`);
      }
    });
}

interface SessionCommandOptions {
  workspace: string;
  config?: string;
  transcripts?: string;
  maxEvents?: string;
  json?: boolean;
}

async function createTranscriptStore(
  options: SessionCommandOptions,
): Promise<JsonlTranscriptStore> {
  const config = await loadMiniCodexConfig({
    ...(options.config === undefined ? {} : { configPath: options.config }),
    workspaceRoot: options.workspace,
  });
  const transcriptDir = options.transcripts ?? config.transcriptDir;

  return new JsonlTranscriptStore({
    directory: resolveConfiguredTranscriptDir(options.workspace, transcriptDir),
  });
}

/** Parses an optional CLI count while preserving `undefined` as "use the default." */
function parseOptionalPositiveInteger(
  value: string | undefined,
  label: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
}
