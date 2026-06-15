#!/usr/bin/env node
import { Command } from 'commander';
import { pathToFileURL } from 'node:url';

const VERSION = '0.1.0';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('mini-codex')
    .description('A small local TypeScript coding agent.')
    .version(VERSION)
    .argument('[prompt...]', 'initial prompt for the agent')
    .option('--no-tui', 'render plain output for non-interactive usage')
    .action((promptParts: string[], options: { tui: boolean }) => {
      const prompt = promptParts.join(' ').trim();

      if (prompt.length === 0) {
        program.help();
        return;
      }

      const mode = options.tui ? 'tui' : 'plain';
      console.log(`mini-codex ${VERSION} (${mode})`);
      console.log(`Prompt: ${prompt}`);
      console.log('Agent loop is not implemented yet.');
    });

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  createProgram().parse(argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
