import { relative, resolve, sep } from 'node:path';

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

  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || relativePath === '') {
    if (relativePath === '') {
      return { absolutePath, projectPath: '.' };
    }

    throw new WorkspacePathError(root, requestedPath);
  }

  return {
    absolutePath,
    projectPath: toProjectPath(relativePath),
  };
}

export function toProjectPath(path: string): string {
  return path.split(sep).join('/');
}
