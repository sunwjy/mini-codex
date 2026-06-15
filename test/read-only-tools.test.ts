import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WorkspacePathError } from '../src/safety/workspace.js';
import { listFiles, readWorkspaceFile, searchWorkspace } from '../src/tools/read-only.js';

describe('read-only workspace tools', () => {
  it('lists text files while skipping local state directories', async () => {
    const root = await fixtureWorkspace();

    expect(await listFiles({ workspaceRoot: root })).toEqual([
      'AGENTS.md',
      'nested/AGENTS.md',
      'nested/file.ts',
      'src/index.ts',
    ]);
  });

  it('rejects reads outside the workspace', async () => {
    const root = await fixtureWorkspace();

    await expect(
      readWorkspaceFile({ path: '../outside.txt', workspaceRoot: root }),
    ).rejects.toBeInstanceOf(WorkspacePathError);
  });

  it('searches workspace files by literal text', async () => {
    const root = await fixtureWorkspace();

    await expect(searchWorkspace({ query: 'targetSymbol', workspaceRoot: root })).resolves.toEqual([
      {
        line: 1,
        path: 'nested/file.ts',
        text: 'export const targetSymbol = true;',
      },
    ]);
  });
});

async function fixtureWorkspace(): Promise<string> {
  const root = join(tmpdir(), `mini-codex-tools-${randomUUID()}`);

  await mkdir(join(root, 'src'), { recursive: true });
  await mkdir(join(root, 'nested'), { recursive: true });
  await mkdir(join(root, '.omx'), { recursive: true });
  await writeFile(join(root, 'AGENTS.md'), '# Root instructions\n');
  await writeFile(join(root, 'src/index.ts'), 'export const value = 1;\n');
  await writeFile(join(root, 'nested/AGENTS.md'), '# Nested instructions\n');
  await writeFile(join(root, 'nested/file.ts'), 'export const targetSymbol = true;\n');
  await writeFile(join(root, '.omx/state.json'), '{"ignored":true}\n');

  return root;
}
