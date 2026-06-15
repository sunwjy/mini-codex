import { describe, expect, it } from 'vitest';
import { NonTtyInteractionPort } from '../src/interaction/index.js';
import type { AgentRunView } from '../src/render/index.js';
import { createRenderer, PlainRenderer, renderInkViewToString } from '../src/render/index.js';

class MemoryOutput {
  readonly chunks: string[] = [];
  readonly isTTY: boolean;

  constructor(isTTY = false) {
    this.isTTY = isTTY;
  }

  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }
}

describe('PlainRenderer', () => {
  it('renders a static agent view through the interaction port', async () => {
    const output = new MemoryOutput();
    const renderer = new PlainRenderer({
      interaction: new NonTtyInteractionPort({ output }),
    });

    await renderer.render(viewFixture());

    expect(output.chunks.join('')).toContain('mini-codex 0.1.0 (plain)');
    expect(output.chunks.join('')).toContain('Prompt: inspect files');
    expect(output.chunks.join('')).toContain('Agent loop is not implemented yet.');
  });
});

describe('Ink renderer view', () => {
  it('can render the static read-only view to a string', () => {
    const output = renderInkViewToString(viewFixture({ mode: 'tui' }));

    expect(output).toContain('mini-codex 0.1.0');
    expect(output).toContain('Prompt: inspect files');
    expect(output).toContain('Status: ready / tui');
  });
});

describe('createRenderer', () => {
  it('falls back to plain rendering when auto mode is non-interactive', () => {
    const renderer = createRenderer({
      input: { isTTY: false },
      output: new MemoryOutput(false),
    });

    expect(renderer.kind).toBe('plain');
  });
});

function viewFixture(overrides: Partial<AgentRunView> = {}): AgentRunView {
  return {
    messages: [{ content: 'Agent loop is not implemented yet.', role: 'system' }],
    mode: 'plain',
    prompt: 'inspect files',
    status: 'ready',
    title: 'mini-codex 0.1.0',
    ...overrides,
  };
}
