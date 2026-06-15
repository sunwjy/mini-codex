#!/usr/bin/env node
import { Command } from 'commander';
import { pathToFileURL } from 'node:url';
import { createRenderer } from '../render/index.js';
import { addSessionCommands } from './session-commands.js';

const VERSION = '0.1.0';

export function createProgram(): Command {
  const program = new Command();

  program.name('mini-codex').description('A small local TypeScript coding agent.').version(VERSION);

  addSessionCommands(program);

  program
    .argument('[prompt...]', 'initial prompt for the agent')
    .option('--no-tui', 'render plain output for non-interactive usage')
    .action(async (promptParts: string[], options: { tui: boolean }) => {
      const prompt = promptParts.join(' ').trim();

      if (prompt.length === 0) {
        program.help();
        return;
      }

      const renderer = createRenderer({ mode: options.tui ? 'auto' : 'plain' });
      const mode = renderer.kind === 'ink' ? 'tui' : 'plain';

      await renderer.render({
        messages: [{ content: 'Agent loop is not implemented yet.', role: 'system' }],
        mode,
        prompt,
        status: 'ready',
        title: `mini-codex ${VERSION}`,
      });
    });

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  await createProgram().parseAsync(argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
