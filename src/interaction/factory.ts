import { InquirerInteractionPort } from './inquirer.js';
import { NonTtyInteractionPort, type WritableOutput } from './non-tty.js';
import type { InteractionPort } from './types.js';

export type InteractionMode = 'auto' | 'inquirer' | 'plain';

/** Minimal readable-stream shape used to detect interactive terminal input. */
export interface TtyReadable {
  isTTY?: boolean;
}

/** Writable output that may advertise terminal capabilities. */
export interface TtyWritable extends WritableOutput {
  isTTY?: boolean;
}

/** Configuration for selecting and constructing an interaction adapter. */
export interface CreateInteractionPortInput {
  mode?: InteractionMode;
  input?: TtyReadable;
  output?: TtyWritable;
}

/** Creates an interaction adapter, selecting a prompt UI only when both streams are TTYs. */
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
