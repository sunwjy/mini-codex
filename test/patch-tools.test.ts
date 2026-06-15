import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WorkspacePathError } from '../src/safety/workspace.js';
import { applyPatch, PatchToolError, previewPatch } from '../src/tools/patch.js';

describe('patch tools', () => {
  it('previews and applies a workspace-only file write', async () => {
    const root = await fixtureWorkspace();

    const preview = await previewPatch({
      operation: {
        content: 'export const value = 2;\n',
        path: 'src/new-file.ts',
        type: 'write',
      },
      workspaceRoot: root,
    });

    expect(preview.changed).toBe(true);
    expect(preview.path).toBe('src/new-file.ts');
    expect(preview.diff).toContain('+export const value = 2;');

    await expect(readFile(join(root, 'src/new-file.ts'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });

    const result = await applyPatch({
      operation: {
        content: 'export const value = 2;\n',
        path: 'src/new-file.ts',
        type: 'write',
      },
      workspaceRoot: root,
    });

    expect(result.applied).toBe(true);
    await expect(readFile(join(root, 'src/new-file.ts'), 'utf8')).resolves.toBe(
      'export const value = 2;\n',
    );
  });

  it('previews and applies literal replacements', async () => {
    const root = await fixtureWorkspace();
    await writeFile(join(root, 'src/index.ts'), 'const name = "old";\nconst other = "old";\n');

    const preview = await previewPatch({
      operation: {
        path: 'src/index.ts',
        replace: '"new"',
        search: '"old"',
        type: 'replace',
      },
      workspaceRoot: root,
    });

    expect(preview.after).toBe('const name = "new";\nconst other = "old";\n');
    expect(preview.diff).toContain('-const name = "old";');
    expect(preview.diff).toContain('+const name = "new";');
  });

  it('rejects missing replace text', async () => {
    const root = await fixtureWorkspace();
    await writeFile(join(root, 'src/index.ts'), 'const value = 1;\n');

    await expect(
      previewPatch({
        operation: {
          path: 'src/index.ts',
          replace: '2',
          search: 'missing',
          type: 'replace',
        },
        workspaceRoot: root,
      }),
    ).rejects.toBeInstanceOf(PatchToolError);
  });

  it('rejects writes outside the workspace', async () => {
    const root = await fixtureWorkspace();

    await expect(
      previewPatch({
        operation: {
          content: 'bad',
          path: '../outside.txt',
          type: 'write',
        },
        workspaceRoot: root,
      }),
    ).rejects.toBeInstanceOf(WorkspacePathError);
  });
});

async function fixtureWorkspace(): Promise<string> {
  const root = join(tmpdir(), `mini-codex-patch-${randomUUID()}`);

  await mkdir(join(root, 'src'), { recursive: true });

  return root;
}
