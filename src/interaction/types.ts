export type InteractionRole = 'system' | 'assistant' | 'tool' | 'error';

/** A message emitted through either an interactive or plain-text adapter. */
export interface InteractionMessage {
  role: InteractionRole;
  content: string;
}

/** Configuration for requesting free-form text. */
export interface TextPrompt {
  message: string;
  defaultValue?: string;
  required?: boolean;
}

/** Configuration for requesting a boolean decision. */
export interface ConfirmPrompt {
  message: string;
  defaultValue?: boolean;
}

/** A labeled value presented by a selection prompt. */
export interface SelectChoice<T extends string = string> {
  label: string;
  value: T;
  description?: string;
}

/** Configuration for choosing one value from a fixed set. */
export interface SelectPrompt<T extends string = string> {
  message: string;
  choices: Array<SelectChoice<T>>;
  defaultValue?: T;
}

/** Transport-independent interface for user-facing messages and prompts. */
export interface InteractionPort {
  write(message: InteractionMessage): Promise<void>;
  promptText(prompt: TextPrompt): Promise<string>;
  confirm(prompt: ConfirmPrompt): Promise<boolean>;
  select<T extends string>(prompt: SelectPrompt<T>): Promise<T>;
}

/** Raised when a non-interactive adapter cannot derive a prompt answer. */
export class InteractionUnavailableError extends Error {
  constructor(
    readonly promptKind: 'text' | 'confirm' | 'select',
    readonly messageText: string,
  ) {
    super(`Interaction is unavailable for ${promptKind} prompt: ${messageText}`);
    this.name = 'InteractionUnavailableError';
  }
}
