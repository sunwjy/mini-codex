import { readFile } from 'node:fs/promises';
import type { RendererMode } from '../render/index.js';
import { resolveWorkspacePath } from '../safety/workspace.js';
import type { ShellPolicyDecision } from '../tools/shell.js';

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

export interface LoadMiniCodexConfigInput {
  workspaceRoot: string;
  configPath?: string;
}

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

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export async function loadMiniCodexConfig(
  input: LoadMiniCodexConfigInput,
): Promise<MiniCodexConfig> {
  const configPath = input.configPath ?? 'mini-codex.config.json';
  const { absolutePath } = resolveWorkspacePath(input.workspaceRoot, configPath);

  try {
    const raw = JSON.parse(await readFile(absolutePath, 'utf8'));
    return mergeConfig(raw);
  } catch (error) {
    if (isNotFoundError(error) && input.configPath === undefined) {
      return DEFAULT_MINI_CODEX_CONFIG;
    }

    if (error instanceof SyntaxError) {
      throw new ConfigError(`${configPath}: invalid JSON`);
    }

    throw error;
  }
}

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

  const config: MiniCodexConfig = structuredClone(DEFAULT_MINI_CODEX_CONFIG);

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
