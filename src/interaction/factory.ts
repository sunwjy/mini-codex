import { InquirerInteractionPort } from './inquirer.js';
import { NonTtyInteractionPort, type WritableOutput } from './non-tty.js';
import type { InteractionPort } from './types.js';

export type InteractionMode = 'auto' | 'inquirer' | 'plain';

export interface TtyReadable {
  isTTY?: boolean;
}

export interface TtyWritable extends WritableOutput {
  isTTY?: boolean;
}

export interface CreateInteractionPortInput {
  mode?: InteractionMode;
  input?: TtyReadable;
  output?: TtyWritable;
}

export function createInteractionPort(input: CreateInteractionPortInput = {}): InteractionPort {
  const mode = input.mode ?? 'auto';
  const output = input.output ?? process.stdout;

  if (mode === 'plain') {
    return new NonTtyInteractionPort({ output });
  }

  if (mode === 'inquirer') {
    return new InquirerInteractionPort({ output });
  }

  const ttyInput = input.input ?? process.stdin;
  const hasInteractiveTty = Boolean(ttyInput.isTTY && output.isTTY);

  return hasInteractiveTty
    ? new InquirerInteractionPort({ output })
    : new NonTtyInteractionPort({ output });
}
