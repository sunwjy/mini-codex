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
