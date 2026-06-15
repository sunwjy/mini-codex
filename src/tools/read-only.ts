import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveWorkspacePath, toProjectPath } from '../safety/workspace.js';

const DEFAULT_IGNORES = new Set([
  '.git',
  '.omx',
  '.pnpm-store',
  'coverage',
  'dist',
  'node_modules',
]);

export interface ListFilesInput {
  workspaceRoot: string;
  maxEntries?: number;
}

export interface ReadFileInput {
  workspaceRoot: string;
  path: string;
}

export interface SearchInput {
  workspaceRoot: string;
  query: string;
  maxResults?: number;
}

export interface SearchResult {
  path: string;
  line: number;
  text: string;
}

export async function listFiles(input: ListFilesInput): Promise<string[]> {
  const maxEntries = input.maxEntries ?? 1_000;
  const results: string[] = [];

  await walk(input.workspaceRoot, '.', async (projectPath) => {
    if (results.length < maxEntries) {
      results.push(projectPath);
    }
  });

  return results.sort();
}

export async function readWorkspaceFile(input: ReadFileInput): Promise<string> {
  const { absolutePath } = resolveWorkspacePath(input.workspaceRoot, input.path);
  return readFile(absolutePath, 'utf8');
}

export async function searchWorkspace(input: SearchInput): Promise<SearchResult[]> {
  const maxResults = input.maxResults ?? 100;
  const files = await listFiles({ workspaceRoot: input.workspaceRoot });
  const results: SearchResult[] = [];

  for (const file of files) {
    if (results.length >= maxResults) {
      break;
    }

    const content = await readWorkspaceFile({ path: file, workspaceRoot: input.workspaceRoot });
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      if (results.length < maxResults && line.includes(input.query)) {
        results.push({
          line: index + 1,
          path: file,
          text: line,
        });
      }
    });
  }

  return results;
}

async function walk(
  workspaceRoot: string,
  projectPath: string,
  onFile: (projectPath: string) => Promise<void>,
): Promise<void> {
  const { absolutePath } = resolveWorkspacePath(workspaceRoot, projectPath);
  const entries = await readdir(absolutePath, { withFileTypes: true });

  for (const entry of entries) {
    if (DEFAULT_IGNORES.has(entry.name)) {
      continue;
    }

    const childProjectPath = projectPath === '.' ? entry.name : `${projectPath}/${entry.name}`;
    const childAbsolutePath = join(absolutePath, entry.name);

    if (entry.isDirectory()) {
      await walk(workspaceRoot, childProjectPath, onFile);
      continue;
    }

    if (entry.isFile() && (await isReadableTextFile(childAbsolutePath))) {
      await onFile(toProjectPath(childProjectPath));
    }
  }
}

async function isReadableTextFile(path: string): Promise<boolean> {
  const fileStat = await stat(path);
  return fileStat.size <= 1024 * 1024;
}
