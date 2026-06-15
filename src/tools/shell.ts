import { spawn } from 'node:child_process';
import type { InteractionPort } from '../interaction/index.js';
import { resolveWorkspacePath } from '../safety/workspace.js';

export type ShellPolicyDecision = 'allow' | 'ask' | 'deny';

export interface ShellPolicy {
  allowPrefixes?: string[][];
  askPrefixes?: string[][];
  denyPrefixes?: string[][];
  defaultDecision?: ShellPolicyDecision;
}

export interface ShellApprovalRequest {
  command: string[];
  cwd: string;
  reason: string;
}

export interface ShellApprovalPort {
  approve(request: ShellApprovalRequest): Promise<boolean>;
}

export interface ExecuteShellCommandInput {
  workspaceRoot: string;
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
  killGraceMs?: number;
  maxOutputBytes?: number;
  policy?: ShellPolicy;
  approval?: ShellApprovalPort;
}

export interface ShellCommandResult {
  command: string[];
  cwd: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
}

export class ShellPolicyError extends Error {
  constructor(
    readonly code: 'approval-denied' | 'approval-required' | 'policy-denied',
    message: string,
  ) {
    super(message);
    this.name = 'ShellPolicyError';
  }
}

export function createInteractionShellApprovalPort(
  interaction: InteractionPort,
): ShellApprovalPort {
  return {
    approve: (request) =>
      interaction.confirm({
        defaultValue: false,
        message: `Run command in ${request.cwd}? ${request.command.join(' ')}`,
      }),
  };
}

export async function executeShellCommand(
  input: ExecuteShellCommandInput,
): Promise<ShellCommandResult> {
  const args = input.args ?? [];
  const command = [input.command, ...args];
  const cwdPath = resolveWorkspacePath(input.workspaceRoot, input.cwd ?? '.');
  const decision = decideShellPolicy(command, input.policy);

  if (decision === 'deny') {
    throw new ShellPolicyError(
      'policy-denied',
      `Shell command is denied by policy: ${command.join(' ')}`,
    );
  }

  if (decision === 'ask') {
    if (!input.approval) {
      throw new ShellPolicyError(
        'approval-required',
        `Shell command requires approval: ${command.join(' ')}`,
      );
    }

    const approved = await input.approval.approve({
      command,
      cwd: cwdPath.projectPath,
      reason: 'Shell policy requires approval',
    });

    if (!approved) {
      throw new ShellPolicyError(
        'approval-denied',
        `Shell command was not approved: ${command.join(' ')}`,
      );
    }
  }

  return spawnWithLimits({
    args,
    command: input.command,
    cwd: cwdPath.absolutePath,
    displayCwd: cwdPath.projectPath,
    killGraceMs: input.killGraceMs ?? 500,
    maxOutputBytes: input.maxOutputBytes ?? 64 * 1024,
    timeoutMs: input.timeoutMs ?? 30_000,
  });
}

export function decideShellPolicy(
  command: string[],
  policy: ShellPolicy = {},
): ShellPolicyDecision {
  if (matchesAnyPrefix(command, policy.denyPrefixes ?? [])) {
    return 'deny';
  }

  if (matchesAnyPrefix(command, policy.askPrefixes ?? [])) {
    return 'ask';
  }

  if (matchesAnyPrefix(command, policy.allowPrefixes ?? [])) {
    return 'allow';
  }

  return policy.defaultDecision ?? 'ask';
}

function matchesAnyPrefix(command: string[], prefixes: string[][]): boolean {
  return prefixes.some((prefix) => prefixMatches(command, prefix));
}

function prefixMatches(command: string[], prefix: string[]): boolean {
  if (prefix.length === 0 || prefix.length > command.length) {
    return false;
  }

  return prefix.every((part, index) => command[index] === part);
}

interface SpawnWithLimitsInput {
  command: string;
  args: string[];
  cwd: string;
  displayCwd: string;
  timeoutMs: number;
  killGraceMs: number;
  maxOutputBytes: number;
}

function spawnWithLimits(input: SpawnWithLimitsInput): Promise<ShellCommandResult> {
  const startedAt = Date.now();
  const child = spawn(input.command, input.args, {
    cwd: input.cwd,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = createBoundedBuffer(input.maxOutputBytes);
  const stderr = createBoundedBuffer(input.maxOutputBytes);
  let timedOut = false;
  let killTimeout: NodeJS.Timeout | undefined;

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
    killTimeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
      }
    }, input.killGraceMs);
  }, input.timeoutMs);

  child.stdout.on('data', (chunk: Buffer) => stdout.append(chunk));
  child.stderr.on('data', (chunk: Buffer) => stderr.append(chunk));

  return new Promise((resolve, reject) => {
    child.on('error', (error) => {
      clearShellTimers(timeout, killTimeout);
      reject(error);
    });

    child.on('close', (exitCode, signal) => {
      clearShellTimers(timeout, killTimeout);
      resolve({
        command: [input.command, ...input.args],
        cwd: input.displayCwd,
        durationMs: Date.now() - startedAt,
        exitCode,
        signal,
        stderr: stderr.toString(),
        stderrTruncated: stderr.truncated,
        stdout: stdout.toString(),
        stdoutTruncated: stdout.truncated,
        timedOut,
      });
    });
  });
}

function clearShellTimers(timeout: NodeJS.Timeout, killTimeout: NodeJS.Timeout | undefined): void {
  clearTimeout(timeout);

  if (killTimeout) {
    clearTimeout(killTimeout);
  }
}

function createBoundedBuffer(maxBytes: number): {
  readonly truncated: boolean;
  append(chunk: Buffer): void;
  toString(): string;
} {
  let buffer = Buffer.alloc(0);
  let truncated = false;

  return {
    get truncated() {
      return truncated;
    },
    append(chunk: Buffer) {
      if (buffer.length >= maxBytes) {
        truncated = true;
        return;
      }

      const next = Buffer.concat([buffer, chunk]);
      if (next.length > maxBytes) {
        buffer = next.subarray(0, maxBytes);
        truncated = true;
        return;
      }

      buffer = next;
    },
    toString() {
      return buffer.toString('utf8');
    },
  };
}
