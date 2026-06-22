import { loadAgentInstructions } from '../instructions/agents.js';
import { listFiles } from '../tools/read-only.js';

/** Inputs that bound project-context discovery to a workspace and optional working directory. */
export interface ProjectContextInput {
  workspaceRoot: string;
  cwd?: string;
  maxFiles?: number;
}

/** Minimal repository context supplied to an agent turn. */
export interface ProjectContext {
  files: string[];
  instructions: Array<{
    path: string;
    content: string;
  }>;
}

/** Collects the repository file list and applicable agent instructions concurrently. */
export async function buildProjectContext(input: ProjectContextInput): Promise<ProjectContext> {
  const [files, instructions] = await Promise.all([
    listFiles({
      ...(input.maxFiles === undefined ? {} : { maxEntries: input.maxFiles }),
      workspaceRoot: input.workspaceRoot,
    }),
    loadAgentInstructions({
      ...(input.cwd === undefined ? {} : { cwd: input.cwd }),
      workspaceRoot: input.workspaceRoot,
    }),
  ]);

  return { files, instructions };
}
