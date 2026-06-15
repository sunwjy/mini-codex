import { mkdir, realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WorkspacePathError } from '../src/safety/workspace.js';
import {
  decideShellPolicy,
  executeShellCommand,
  ShellPolicyError,
  type ShellApprovalPort,
} from '../src/tools/shell.js';

describe('decideShellPolicy', () => {
  it('uses deny, ask, allow, then default precedence', () => {
    expect(
      decideShellPolicy(['git', 'status'], {
        allowPrefixes: [['git']],
        denyPrefixes: [['git', 'status']],
      }),
    ).toBe('deny');
    expect(decideShellPolicy(['pnpm', 'install'], { askPrefixes: [['pnpm']] })).toBe('ask');
    expect(decideShellPolicy(['node', '--version'], { allowPrefixes: [['node']] })).toBe('allow');
    expect(decideShellPolicy(['unknown'], { defaultDecision: 'deny' })).toBe('deny');
  });
});

describe('executeShellCommand', () => {
  it('executes allowed argv commands inside the workspace', async () => {
    const root = await fixtureWorkspace();

    const result = await executeShellCommand({
      args: ['-e', 'process.stdout.write(process.cwd())'],
      command: process.execPath,
      policy: { allowPrefixes: [[process.execPath]] },
      workspaceRoot: root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(root);
    expect(result.timedOut).toBe(false);
  });

  it('routes ask decisions through approval', async () => {
    const root = await fixtureWorkspace();
    const approvals: string[] = [];
    const approval: ShellApprovalPort = {
      approve: async (request) => {
        approvals.push(request.command.join(' '));
        return true;
      },
    };

    const result = await executeShellCommand({
      args: ['-e', 'process.stdout.write("approved")'],
      approval,
      command: process.execPath,
      policy: { askPrefixes: [[process.execPath]] },
      workspaceRoot: root,
    });

    expect(result.stdout).toBe('approved');
    expect(approvals).toHaveLength(1);
  });

  it('rejects denied or unapproved commands before execution', async () => {
    const root = await fixtureWorkspace();

    await expect(
      executeShellCommand({
        command: process.execPath,
        policy: { denyPrefixes: [[process.execPath]] },
        workspaceRoot: root,
      }),
    ).rejects.toBeInstanceOf(ShellPolicyError);

    await expect(
      executeShellCommand({
        approval: { approve: async () => false },
        command: process.execPath,
        policy: { askPrefixes: [[process.execPath]] },
        workspaceRoot: root,
      }),
    ).rejects.toBeInstanceOf(ShellPolicyError);
  });

  it('truncates captured output', async () => {
    const root = await fixtureWorkspace();

    const result = await executeShellCommand({
      args: ['-e', 'process.stdout.write("abcdefghij")'],
      command: process.execPath,
      maxOutputBytes: 4,
      policy: { allowPrefixes: [[process.execPath]] },
      workspaceRoot: root,
    });

    expect(result.stdout).toBe('abcd');
    expect(result.stdoutTruncated).toBe(true);
  });

  it('terminates commands after timeout', async () => {
    const root = await fixtureWorkspace();

    const result = await executeShellCommand({
      args: ['-e', 'setTimeout(() => {}, 1000)'],
      command: process.execPath,
      policy: { allowPrefixes: [[process.execPath]] },
      timeoutMs: 50,
      workspaceRoot: root,
    });

    expect(result.timedOut).toBe(true);
  });

  it('rejects cwd outside the workspace', async () => {
    const root = await fixtureWorkspace();

    await expect(
      executeShellCommand({
        command: process.execPath,
        cwd: '..',
        policy: { allowPrefixes: [[process.execPath]] },
        workspaceRoot: root,
      }),
    ).rejects.toBeInstanceOf(WorkspacePathError);
  });
});

async function fixtureWorkspace(): Promise<string> {
  const root = join(tmpdir(), `mini-codex-shell-${randomUUID()}`);

  await mkdir(root, { recursive: true });

  return realpath(root);
}
