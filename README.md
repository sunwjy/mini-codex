# mini-codex

A small TypeScript local coding agent inspired by Codex, nanoGPT, and
micrograd.

## Requirements

- Node.js 22.13 or newer
- pnpm 11

## Development

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm mini-codex --help
```

The project starts with a small CLI shell and grows toward a local coding agent
with typed events, a transcript store, read-only tools, approvals, and an Ink
TUI.

The root prompt command currently renders a static placeholder run view. The
agent loop and tool execution layers are available as modules, but they are not
yet wired into the root prompt command.

## CLI

```sh
pnpm mini-codex --no-tui "inspect the workspace"
pnpm mini-codex status
pnpm mini-codex resume <thread-id>
pnpm mini-codex compact <thread-id>
```

Session commands read JSONL transcripts from `.mini-codex/transcripts` by
default. Use `--json` for machine-readable output, `--workspace <path>` to
choose a workspace root, `--transcripts <path>` to override the transcript
directory, and `--config <path>` to load a config file inside the workspace.

## Configuration

`mini-codex.config.json` is optional. Supported fields:

```json
{
  "transcriptDir": ".mini-codex/transcripts",
  "renderer": "auto",
  "compaction": {
    "maxEvents": 40
  },
  "shell": {
    "timeoutMs": 30000,
    "maxOutputBytes": 65536,
    "defaultDecision": "ask"
  }
}
```
