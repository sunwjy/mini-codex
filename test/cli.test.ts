import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createProgram, PLACEHOLDER_AGENT_MESSAGE } from '../src/cli/index.js';

describe('createProgram', () => {
  it('configures the mini-codex command name', () => {
    const program = createProgram();

    expect(program.name()).toBe('mini-codex');
  });

  it('registers session management commands', () => {
    const program = createProgram();

    expect(program.commands.map((command) => command.name()).sort()).toEqual([
      'compact',
      'resume',
      'status',
    ]);
  });

  it('documents the root prompt path as a placeholder contract', () => {
    expect(PLACEHOLDER_AGENT_MESSAGE).toBe('Agent loop is not implemented yet.');
  });

  it('points the package binary at the built CLI entrypoint', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as {
      bin?: Record<string, string>;
    };

    expect(packageJson.bin?.['mini-codex']).toBe('./dist/src/cli/index.js');
  });
});
