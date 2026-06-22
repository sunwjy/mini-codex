import type {
  ConfirmPrompt,
  InteractionMessage,
  InteractionPort,
  SelectPrompt,
  TextPrompt,
} from './types.js';
import { InteractionUnavailableError } from './types.js';

export interface WritableOutput {
  write(chunk: string): unknown;
}

/** Configuration for deterministic, non-interactive output. */
export interface NonTtyInteractionPortOptions {
  output?: WritableOutput;
}

/**
 * Interaction adapter for pipelines and redirected output.
 *
 * Prompts resolve only when a deterministic answer is available; otherwise they
 * fail instead of attempting to read from a non-interactive stream.
 */
export class NonTtyInteractionPort implements InteractionPort {
  readonly output: WritableOutput;

  constructor(options: NonTtyInteractionPortOptions = {}) {
    this.output = options.output ?? process.stdout;
  }

  async write(message: InteractionMessage): Promise<void> {
    this.output.write(`${formatMessage(message)}\n`);
  }

  async promptText(prompt: TextPrompt): Promise<string> {
    // Non-interactive execution can answer only from deterministic prompt metadata.
    if (prompt.defaultValue !== undefined) {
      return prompt.defaultValue;
    }

    throw new InteractionUnavailableError('text', prompt.message);
  }

  async confirm(prompt: ConfirmPrompt): Promise<boolean> {
    // Never invent consent when input is unavailable; require the caller to provide a default.
    if (prompt.defaultValue !== undefined) {
      return prompt.defaultValue;
    }

    throw new InteractionUnavailableError('confirm', prompt.message);
  }

  async select<T extends string>(prompt: SelectPrompt<T>): Promise<T> {
    // Prefer an explicit default before considering the single-choice fallback below.
    if (prompt.defaultValue !== undefined) {
      return prompt.defaultValue;
    }

    const [onlyChoice] = prompt.choices;

    // A single option is deterministic even when the caller omitted a default.
    if (onlyChoice && prompt.choices.length === 1) {
      return onlyChoice.value;
    }

    throw new InteractionUnavailableError('select', prompt.message);
  }
}

function formatMessage(message: InteractionMessage): string {
  if (message.role === 'system') {
    return message.content;
  }

  return `${message.role}: ${message.content}`;
}
