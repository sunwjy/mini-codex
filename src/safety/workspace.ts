import { lstatSync, realpathSync, type Stats } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

export class WorkspacePathError extends Error {
  constructor(
    readonly workspaceRoot: string,
    readonly requestedPath: string,
  ) {
    super(`Path escapes workspace: ${requestedPath}`);
    this.name = 'WorkspacePathError';
  }
}

export interface WorkspacePath {
  absolutePath: string;
  projectPath: string;
}

export function resolveWorkspacePath(workspaceRoot: string, requestedPath: string): WorkspacePath {
  const root = resolve(workspaceRoot);
  const absolutePath = resolve(root, requestedPath);
  const relativePath = relative(root, absolutePath);

  if (escapesRoot(relativePath)) {
    throw new WorkspacePathError(root, requestedPath);
  }

  assertCanonicalWorkspacePath(root, absolutePath, relativePath, requestedPath);

  if (relativePath === '') {
    return { absolutePath, projectPath: '.' };
  }

  return {
    absolutePath,
    projectPath: toProjectPath(relativePath),
  };
}

export function toProjectPath(path: string): string {
  return path.split(sep).join('/');
}

function assertCanonicalWorkspacePath(
  root: string,
  absolutePath: string,
  relativePath: string,
  requestedPath: string,
): void {
  const rootRealPath = realpathSync(root);

  if (relativePath === '') {
    return;
  }

  let currentPath = root;
  const segments = relativePath.split(sep).filter((segment) => segment.length > 0);

  for (const segment of segments) {
    currentPath = join(currentPath, segment);

    let stats: Stats;
    try {
      stats = lstatSync(currentPath);
    } catch (error) {
      if (isNotFoundError(error)) {
        break;
      }

      throw error;
    }

    if (stats.isSymbolicLink()) {
      throw new WorkspacePathError(root, requestedPath);
    }

    if (escapesRoot(relative(rootRealPath, realpathSync(currentPath)))) {
      throw new WorkspacePathError(root, requestedPath);
    }
  }

  if (escapesRoot(relative(rootRealPath, resolve(rootRealPath, relative(root, absolutePath))))) {
    throw new WorkspacePathError(root, requestedPath);
  }
}

function escapesRoot(relativePath: string): boolean {
  return relativePath === '..' || relativePath.startsWith(`..${sep}`);
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
