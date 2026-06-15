import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createTwoFilesPatch } from 'diff';
import { resolveWorkspacePath } from '../safety/workspace.js';

export type PatchOperation =
  | {
      type: 'write';
      path: string;
      content: string;
    }
  | {
      type: 'replace';
      path: string;
      search: string;
      replace: string;
      replaceAll?: boolean;
    };

export interface PreviewPatchInput {
  workspaceRoot: string;
  operation: PatchOperation;
}

export interface PatchPreview {
  path: string;
  operation: PatchOperation['type'];
  before: string;
  after: string;
  changed: boolean;
  diff: string;
}

export interface PatchApplyResult extends PatchPreview {
  applied: boolean;
}

export class PatchToolError extends Error {
  constructor(
    readonly code: 'empty-search' | 'missing-file' | 'missing-search',
    message: string,
  ) {
    super(message);
    this.name = 'PatchToolError';
  }
}

export async function previewPatch(input: PreviewPatchInput): Promise<PatchPreview> {
  const target = resolveWorkspacePath(input.workspaceRoot, input.operation.path);
  const before = await readExistingFile(target.absolutePath);
  const after = nextContent(input.operation, before);
  const changed = before !== after;

  return {
    after,
    before,
    changed,
    diff: changed ? createDiff(target.projectPath, before, after) : '',
    operation: input.operation.type,
    path: target.projectPath,
  };
}

export async function applyPatch(input: PreviewPatchInput): Promise<PatchApplyResult> {
  const target = resolveWorkspacePath(input.workspaceRoot, input.operation.path);
  const preview = await previewPatch(input);

  if (!preview.changed) {
    return { ...preview, applied: false };
  }

  await mkdir(dirname(target.absolutePath), { recursive: true });
  await writeFile(target.absolutePath, preview.after, 'utf8');

  return { ...preview, applied: true };
}

async function readExistingFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isNotFoundError(error)) {
      return '';
    }

    throw error;
  }
}

function nextContent(operation: PatchOperation, before: string): string {
  if (operation.type === 'write') {
    return operation.content;
  }

  if (before.length === 0) {
    throw new PatchToolError(
      'missing-file',
      `Cannot replace text in missing file: ${operation.path}`,
    );
  }

  if (operation.search.length === 0) {
    throw new PatchToolError('empty-search', 'Replace operation search text cannot be empty');
  }

  if (!before.includes(operation.search)) {
    throw new PatchToolError('missing-search', `Search text was not found in ${operation.path}`);
  }

  return operation.replaceAll
    ? before.split(operation.search).join(operation.replace)
    : before.replace(operation.search, operation.replace);
}

function createDiff(projectPath: string, before: string, after: string): string {
  return createTwoFilesPatch(projectPath, projectPath, before, after, 'before', 'after', {
    context: 3,
  });
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
