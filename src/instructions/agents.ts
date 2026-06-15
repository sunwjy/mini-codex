import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { resolveWorkspacePath, toProjectPath } from '../safety/workspace.js';

export interface AgentInstructionFile {
  path: string;
  content: string;
}

export interface LoadAgentInstructionsInput {
  workspaceRoot: string;
  cwd?: string;
}

export async function loadAgentInstructions(
  input: LoadAgentInstructionsInput,
): Promise<AgentInstructionFile[]> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const cwdPath = resolveWorkspacePath(workspaceRoot, input.cwd ?? '.').absolutePath;
  const relativeCwd = relative(workspaceRoot, cwdPath);
  const segments = relativeCwd.length === 0 ? [] : relativeCwd.split(/[\\/]+/);
  const directories = ['.'];

  for (let index = 0; index < segments.length; index += 1) {
    directories.push(segments.slice(0, index + 1).join('/'));
  }

  const files: AgentInstructionFile[] = [];

  for (const directory of directories) {
    const instructionPath = directory === '.' ? 'AGENTS.md' : `${directory}/AGENTS.md`;
    const { absolutePath, projectPath } = resolveWorkspacePath(workspaceRoot, instructionPath);

    try {
      files.push({
        content: await readFile(absolutePath, 'utf8'),
        path: toProjectPath(projectPath),
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        continue;
      }

      throw error;
    }
  }

  return files;
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
