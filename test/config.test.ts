import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  DEFAULT_MINI_CODEX_CONFIG,
  loadMiniCodexConfig,
  resolveConfiguredTranscriptDir,
} from '../src/config/config.js';

describe('loadMiniCodexConfig', () => {
  it('returns defaults when no default config file exists', async () => {
    const root = await fixtureWorkspace();

    await expect(loadMiniCodexConfig({ workspaceRoot: root })).resolves.toEqual(
      DEFAULT_MINI_CODEX_CONFIG,
    );
  });

  it('merges user config with defaults', async () => {
    const root = await fixtureWorkspace();
    await writeFile(
      join(root, 'mini-codex.config.json'),
      JSON.stringify({
        compaction: { maxEvents: 5 },
        renderer: 'plain',
        shell: { defaultDecision: 'deny', timeoutMs: 1000 },
        transcriptDir: '.state/transcripts',
      }),
    );

    const config = await loadMiniCodexConfig({ workspaceRoot: root });

    expect(config).toMatchObject({
      compaction: { maxEvents: 5 },
      renderer: 'plain',
      shell: { defaultDecision: 'deny', timeoutMs: 1000 },
      transcriptDir: '.state/transcripts',
    });
    expect(config.shell.maxOutputBytes).toBe(DEFAULT_MINI_CODEX_CONFIG.shell.maxOutputBytes);
  });

  it('rejects invalid config values', async () => {
    const root = await fixtureWorkspace();
    await writeFile(join(root, 'bad.json'), JSON.stringify({ renderer: 'invalid' }));

    await expect(
      loadMiniCodexConfig({ configPath: 'bad.json', workspaceRoot: root }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it('resolves transcript directories inside the workspace', async () => {
    const root = await fixtureWorkspace();

    expect(resolveConfiguredTranscriptDir(root, '.mini-codex/transcripts')).toBe(
      join(root, '.mini-codex/transcripts'),
    );
  });
});

async function fixtureWorkspace(): Promise<string> {
  const root = join(tmpdir(), `mini-codex-config-${randomUUID()}`);

  await mkdir(root, { recursive: true });

  return root;
}
