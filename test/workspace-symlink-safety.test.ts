import { randomUUID } from 'node:crypto';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadMiniCodexConfig } from '../src/config/config.js';
import { loadAgentInstructions } from '../src/instructions/agents.js';
import { WorkspacePathError } from '../src/safety/workspace.js';
import { previewPatch } from '../src/tools/patch.js';
import { readWorkspaceFile } from '../src/tools/read-only.js';
import { executeShellCommand } from '../src/tools/shell.js';

describe('workspace symlink safety', () => {
  it('rejects symlink escapes across filesystem-facing tools', async () => {
    const { root } = await symlinkEscapeFixture();

    await expect(
      readWorkspaceFile({ path: 'link/secret.txt', workspaceRoot: root }),
    ).rejects.toBeInstanceOf(WorkspacePathError);

    await expect(
      previewPatch({
        operation: {
          content: 'escaped',
          path: 'link/escape.txt',
          type: 'write',
        },
        workspaceRoot: root,
      }),
    ).rejects.toBeInstanceOf(WorkspacePathError);

    await expect(
      executeShellCommand({
        command: process.execPath,
        cwd: 'link',
        policy: { allowPrefixes: [[process.execPath]] },
        workspaceRoot: root,
      }),
    ).rejects.toBeInstanceOf(WorkspacePathError);

    await expect(
      loadMiniCodexConfig({
        configPath: 'link/mini-codex.config.json',
        workspaceRoot: root,
      }),
    ).rejects.toBeInstanceOf(WorkspacePathError);

    await expect(
      loadAgentInstructions({
        cwd: 'link',
        workspaceRoot: root,
      }),
    ).rejects.toBeInstanceOf(WorkspacePathError);
  });
});

async function symlinkEscapeFixture(): Promise<{ root: string; external: string }> {
  const root = join(tmpdir(), `mini-codex-safe-root-${randomUUID()}`);
  const external = join(tmpdir(), `mini-codex-safe-external-${randomUUID()}`);

  await mkdir(root, { recursive: true });
  await mkdir(external, { recursive: true });
  await writeFile(join(external, 'secret.txt'), 'outside\n');
  await writeFile(join(external, 'AGENTS.md'), '# Outside\n');
  await writeFile(join(external, 'mini-codex.config.json'), '{"renderer":"plain"}\n');
  await symlink(external, join(root, 'link'), 'dir');

  return { external, root };
}
