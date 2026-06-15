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

export interface NonTtyInteractionPortOptions {
  output?: WritableOutput;
}

export class NonTtyInteractionPort implements InteractionPort {
  readonly output: WritableOutput;

  constructor(options: NonTtyInteractionPortOptions = {}) {
    this.output = options.output ?? process.stdout;
  }

  async write(message: InteractionMessage): Promise<void> {
    this.output.write(`${formatMessage(message)}\n`);
  }

  async promptText(prompt: TextPrompt): Promise<string> {
    if (prompt.defaultValue !== undefined) {
      return prompt.defaultValue;
    }

    throw new InteractionUnavailableError('text', prompt.message);
  }

  async confirm(prompt: ConfirmPrompt): Promise<boolean> {
    if (prompt.defaultValue !== undefined) {
      return prompt.defaultValue;
    }

    throw new InteractionUnavailableError('confirm', prompt.message);
  }

  async select<T extends string>(prompt: SelectPrompt<T>): Promise<T> {
    if (prompt.defaultValue !== undefined) {
      return prompt.defaultValue;
    }

    const [onlyChoice] = prompt.choices;

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
