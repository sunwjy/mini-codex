import { confirm, input, select } from '@inquirer/prompts';
import type {
  ConfirmPrompt,
  InteractionMessage,
  InteractionPort,
  SelectPrompt,
  TextPrompt,
} from './types.js';

interface InquirerTextConfig {
  message: string;
  default?: string;
  required?: boolean;
}

interface InquirerConfirmConfig {
  message: string;
  default?: boolean;
}

interface InquirerSelectChoice<T extends string> {
  name: string;
  value: T;
  description?: string;
}

interface InquirerSelectConfig<T extends string> {
  message: string;
  choices: Array<InquirerSelectChoice<T>>;
  default?: T;
}

export interface InquirerPromptFunctions {
  input(config: InquirerTextConfig): Promise<string>;
  confirm(config: InquirerConfirmConfig): Promise<boolean>;
  select<T extends string>(config: InquirerSelectConfig<T>): Promise<T>;
}

export interface InquirerInteractionPortOptions {
  output?: {
    write(chunk: string): unknown;
  };
  prompts?: InquirerPromptFunctions;
}

export class InquirerInteractionPort implements InteractionPort {
  readonly output: {
    write(chunk: string): unknown;
  };
  readonly prompts: InquirerPromptFunctions;

  constructor(options: InquirerInteractionPortOptions = {}) {
    this.output = options.output ?? process.stdout;
    this.prompts = options.prompts ?? {
      confirm: (config) => confirm(config),
      input: (config) => input(config),
      select: (config) => select(config),
    };
  }

  async write(message: InteractionMessage): Promise<void> {
    if (message.role === 'system') {
      this.output.write(`${message.content}\n`);
      return;
    }

    this.output.write(`${message.role}: ${message.content}\n`);
  }

  async promptText(prompt: TextPrompt): Promise<string> {
    return this.prompts.input({
      ...(prompt.defaultValue === undefined ? {} : { default: prompt.defaultValue }),
      message: prompt.message,
      ...(prompt.required === undefined ? {} : { required: prompt.required }),
    });
  }

  async confirm(prompt: ConfirmPrompt): Promise<boolean> {
    return this.prompts.confirm({
      ...(prompt.defaultValue === undefined ? {} : { default: prompt.defaultValue }),
      message: prompt.message,
    });
  }

  async select<T extends string>(prompt: SelectPrompt<T>): Promise<T> {
    return this.prompts.select({
      choices: prompt.choices.map((choice) => ({
        ...(choice.description === undefined ? {} : { description: choice.description }),
        name: choice.label,
        value: choice.value,
      })),
      ...(prompt.defaultValue === undefined ? {} : { default: prompt.defaultValue }),
      message: prompt.message,
    });
  }
}
