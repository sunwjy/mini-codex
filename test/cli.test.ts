import { describe, expect, it } from 'vitest';
import { createProgram } from '../src/cli/index.js';

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
});
