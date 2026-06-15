import { describe, expect, it } from 'vitest';
import {
  createInteractionPort,
  InquirerInteractionPort,
  InteractionUnavailableError,
  NonTtyInteractionPort,
} from '../src/interaction/index.js';

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

describe('NonTtyInteractionPort', () => {
  it('writes plain system output without a role prefix', async () => {
    const output = new MemoryOutput();
    const port = new NonTtyInteractionPort({ output });

    await port.write({ content: 'hello', role: 'system' });

    expect(output.chunks).toEqual(['hello\n']);
  });

  it('returns explicit defaults for non-interactive prompts', async () => {
    const port = new NonTtyInteractionPort();

    await expect(port.promptText({ defaultValue: 'mini', message: 'Name?' })).resolves.toBe('mini');
    await expect(port.confirm({ defaultValue: true, message: 'Proceed?' })).resolves.toBe(true);
    await expect(
      port.select({
        choices: [
          { label: 'Plain', value: 'plain' },
          { label: 'TUI', value: 'tui' },
        ],
        defaultValue: 'plain',
        message: 'Mode?',
      }),
    ).resolves.toBe('plain');
  });

  it('rejects prompts without deterministic non-interactive answers', async () => {
    const port = new NonTtyInteractionPort();

    await expect(port.promptText({ message: 'Name?' })).rejects.toBeInstanceOf(
      InteractionUnavailableError,
    );
  });
});

describe('InquirerInteractionPort', () => {
  it('delegates prompt requests to injected inquirer functions', async () => {
    const seenMessages: string[] = [];
    const port = new InquirerInteractionPort({
      prompts: {
        confirm: async (config) => {
          seenMessages.push(config.message);
          return config.default ?? false;
        },
        input: async (config) => {
          seenMessages.push(config.message);
          return config.default ?? '';
        },
        select: async (config) => {
          seenMessages.push(config.message);
          const [firstChoice] = config.choices;
          if (!firstChoice) {
            throw new Error('expected at least one choice');
          }

          return config.default ?? firstChoice.value;
        },
      },
    });

    await expect(port.promptText({ defaultValue: 'Jane', message: 'Name?' })).resolves.toBe('Jane');
    await expect(port.confirm({ defaultValue: true, message: 'Proceed?' })).resolves.toBe(true);
    await expect(
      port.select({
        choices: [{ label: 'Plain', value: 'plain' }],
        message: 'Mode?',
      }),
    ).resolves.toBe('plain');
    expect(seenMessages).toEqual(['Name?', 'Proceed?', 'Mode?']);
  });
});

describe('createInteractionPort', () => {
  it('uses non-TTY adapter when auto mode has no interactive streams', () => {
    const port = createInteractionPort({
      input: { isTTY: false },
      output: new MemoryOutput(false),
    });

    expect(port).toBeInstanceOf(NonTtyInteractionPort);
  });

  it('uses inquirer adapter when explicitly requested', () => {
    const port = createInteractionPort({
      mode: 'inquirer',
      output: new MemoryOutput(true),
    });

    expect(port).toBeInstanceOf(InquirerInteractionPort);
  });
});
