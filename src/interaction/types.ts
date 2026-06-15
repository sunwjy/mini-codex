export type InteractionRole = 'system' | 'assistant' | 'tool' | 'error';

export interface InteractionMessage {
  role: InteractionRole;
  content: string;
}

export interface TextPrompt {
  message: string;
  defaultValue?: string;
  required?: boolean;
}

export interface ConfirmPrompt {
  message: string;
  defaultValue?: boolean;
}

export interface SelectChoice<T extends string = string> {
  label: string;
  value: T;
  description?: string;
}

export interface SelectPrompt<T extends string = string> {
  message: string;
  choices: Array<SelectChoice<T>>;
  defaultValue?: T;
}

export interface InteractionPort {
  write(message: InteractionMessage): Promise<void>;
  promptText(prompt: TextPrompt): Promise<string>;
  confirm(prompt: ConfirmPrompt): Promise<boolean>;
  select<T extends string>(prompt: SelectPrompt<T>): Promise<T>;
}

export class InteractionUnavailableError extends Error {
  constructor(
    readonly promptKind: 'text' | 'confirm' | 'select',
    readonly messageText: string,
  ) {
    super(`Interaction is unavailable for ${promptKind} prompt: ${messageText}`);
    this.name = 'InteractionUnavailableError';
  }
}
