import { readFile } from 'node:fs/promises';
import type { RendererMode } from '../render/index.js';
import { resolveWorkspacePath } from '../safety/workspace.js';
import type { ShellPolicyDecision } from '../tools/shell.js';

/** Runtime settings loaded from the workspace configuration file. */
export interface MiniCodexConfig {
  transcriptDir: string;
  renderer: RendererMode;
  compaction: {
    maxEvents: number;
  };
  shell: {
    timeoutMs: number;
    maxOutputBytes: number;
    defaultDecision: ShellPolicyDecision;
  };
}

/** Inputs used to locate a workspace-scoped configuration file. */
export interface LoadMiniCodexConfigInput {
  workspaceRoot: string;
  configPath?: string;
}

/** Baseline settings used when a value is omitted or no default config file exists. */
export const DEFAULT_MINI_CODEX_CONFIG: MiniCodexConfig = {
  compaction: {
    maxEvents: 40,
  },
  renderer: 'auto',
  shell: {
    defaultDecision: 'ask',
    maxOutputBytes: 64 * 1024,
    timeoutMs: 30_000,
  },
  transcriptDir: '.mini-codex/transcripts',
};

/** Indicates that a configuration file is present but contains invalid settings. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Loads and validates workspace configuration, applying defaults for omitted fields. */
export async function loadMiniCodexConfig(
  input: LoadMiniCodexConfigInput,
): Promise<MiniCodexConfig> {
  const configPath = input.configPath ?? 'mini-codex.config.json';
  const { absolutePath } = resolveWorkspacePath(input.workspaceRoot, configPath);

  try {
    const raw = JSON.parse(await readFile(absolutePath, 'utf8'));
    return mergeConfig(raw);
  } catch (error) {
    // A missing conventional config is optional, but a missing explicitly requested file is not.
    if (isNotFoundError(error) && input.configPath === undefined) {
      return DEFAULT_MINI_CODEX_CONFIG;
    }

    // Normalize parser failures so callers do not depend on engine-specific JSON errors.
    if (error instanceof SyntaxError) {
      throw new ConfigError(`${configPath}: invalid JSON`);
    }

    throw error;
  }
}

/** Resolves the configured transcript directory within the workspace boundary. */
export function resolveConfiguredTranscriptDir(
  workspaceRoot: string,
  transcriptDir: string,
): string {
  return resolveWorkspacePath(workspaceRoot, transcriptDir).absolutePath;
}

function mergeConfig(raw: unknown): MiniCodexConfig {
  if (!isRecord(raw)) {
    throw new ConfigError('Config must be a JSON object');
  }

  // Clone nested defaults so callers cannot mutate the shared baseline through the result.
  const config: MiniCodexConfig = structuredClone(DEFAULT_MINI_CODEX_CONFIG);

  // Validate only supplied fields so partial configuration can safely inherit defaults.
  if (raw.transcriptDir !== undefined) {
    if (typeof raw.transcriptDir !== 'string' || raw.transcriptDir.length === 0) {
      throw new ConfigError('transcriptDir must be a non-empty string');
    }
    config.transcriptDir = raw.transcriptDir;
  }

  if (raw.renderer !== undefined) {
    if (!isRendererMode(raw.renderer)) {
      throw new ConfigError('renderer must be one of auto, plain, or tui');
    }
    config.renderer = raw.renderer;
  }

  if (raw.compaction !== undefined) {
    // Reject arrays and primitives before reading nested compaction settings.
    if (!isRecord(raw.compaction)) {
      throw new ConfigError('compaction must be an object');
    }

    if (raw.compaction.maxEvents !== undefined) {
      if (!isPositiveInteger(raw.compaction.maxEvents)) {
        throw new ConfigError('compaction.maxEvents must be a positive integer');
      }
      config.compaction.maxEvents = raw.compaction.maxEvents;
    }
  }

  if (raw.shell !== undefined) {
    // Nested shell settings follow the same partial-override contract as top-level fields.
    if (!isRecord(raw.shell)) {
      throw new ConfigError('shell must be an object');
    }

    if (raw.shell.timeoutMs !== undefined) {
      if (!isPositiveInteger(raw.shell.timeoutMs)) {
        throw new ConfigError('shell.timeoutMs must be a positive integer');
      }
      config.shell.timeoutMs = raw.shell.timeoutMs;
    }

    if (raw.shell.maxOutputBytes !== undefined) {
      if (!isPositiveInteger(raw.shell.maxOutputBytes)) {
        throw new ConfigError('shell.maxOutputBytes must be a positive integer');
      }
      config.shell.maxOutputBytes = raw.shell.maxOutputBytes;
    }

    if (raw.shell.defaultDecision !== undefined) {
      if (!isShellDecision(raw.shell.defaultDecision)) {
        throw new ConfigError('shell.defaultDecision must be allow, ask, or deny');
      }
      config.shell.defaultDecision = raw.shell.defaultDecision;
    }
  }

  return config;
}

function isRendererMode(value: unknown): value is RendererMode {
  return value === 'auto' || value === 'plain' || value === 'tui';
}

function isShellDecision(value: unknown): value is ShellPolicyDecision {
  return value === 'allow' || value === 'ask' || value === 'deny';
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value > 0;
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
