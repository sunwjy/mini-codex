import { createInteractionPort, type TtyReadable, type TtyWritable } from '../interaction/index.js';
import { InkRenderer } from './ink.js';
import { PlainRenderer } from './plain.js';
import type { AgentRenderer } from './types.js';

export type RendererMode = 'auto' | 'plain' | 'tui';

export interface CreateRendererInput {
  mode?: RendererMode;
  input?: TtyReadable;
  output?: TtyWritable;
  errorOutput?: NodeJS.WriteStream;
}

export function createRenderer(input: CreateRendererInput = {}): AgentRenderer {
  const mode = input.mode ?? 'auto';
  const output = input.output ?? process.stdout;

  if (mode === 'plain') {
    return createPlainRenderer(output);
  }

  if (mode === 'tui') {
    return new InkRenderer({
      ...(input.errorOutput === undefined ? {} : { errorOutput: input.errorOutput }),
      ...(input.input === undefined ? {} : { input: input.input as NodeJS.ReadStream }),
      output: output as NodeJS.WriteStream,
    });
  }

  const ttyInput = input.input ?? process.stdin;
  const hasInteractiveTty = Boolean(ttyInput.isTTY && output.isTTY);

  return hasInteractiveTty
    ? new InkRenderer({
        ...(input.errorOutput === undefined ? {} : { errorOutput: input.errorOutput }),
        input: ttyInput as NodeJS.ReadStream,
        output: output as NodeJS.WriteStream,
      })
    : createPlainRenderer(output);
}

function createPlainRenderer(output: TtyWritable): PlainRenderer {
  return new PlainRenderer({
    interaction: createInteractionPort({ mode: 'plain', output }),
  });
}
