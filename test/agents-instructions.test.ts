import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildProjectContext } from '../src/context/project-context.js';
import { loadAgentInstructions } from '../src/instructions/agents.js';

describe('loadAgentInstructions', () => {
  it('loads AGENTS.md from root to cwd order', async () => {
    const root = await fixtureWorkspace();

    await expect(
      loadAgentInstructions({ cwd: 'packages/app', workspaceRoot: root }),
    ).resolves.toEqual([
      { content: '# Root\n', path: 'AGENTS.md' },
      { content: '# App\n', path: 'packages/app/AGENTS.md' },
    ]);
  });
});

describe('buildProjectContext', () => {
  it('combines file listing and instruction discovery', async () => {
    const root = await fixtureWorkspace();

    const context = await buildProjectContext({ cwd: 'packages/app', workspaceRoot: root });

    expect(context.files).toContain('packages/app/AGENTS.md');
    expect(context.instructions.map((file) => file.path)).toEqual([
      'AGENTS.md',
      'packages/app/AGENTS.md',
    ]);
  });
});

async function fixtureWorkspace(): Promise<string> {
  const root = join(tmpdir(), `mini-codex-agents-${randomUUID()}`);

  await mkdir(join(root, 'packages/app'), { recursive: true });
  await writeFile(join(root, 'AGENTS.md'), '# Root\n');
  await writeFile(join(root, 'packages/app/AGENTS.md'), '# App\n');

  return root;
}
