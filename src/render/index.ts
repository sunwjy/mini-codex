// Expose renderer contracts and implementations through a stable public entry point.
export { createRenderer, type RendererMode } from './factory.js';
export { InkRenderer, renderInkViewToString } from './ink.js';
export { PlainRenderer } from './plain.js';
export type {
  AgentRenderer,
  AgentRunStatus,
  AgentRunView,
  RendererKind,
  RenderMessage,
} from './types.js';
