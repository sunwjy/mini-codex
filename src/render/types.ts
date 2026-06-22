export type RendererKind = 'ink' | 'plain';

export type AgentRunStatus = 'ready' | 'running' | 'completed' | 'failed';

export type RenderMessageRole = 'system' | 'assistant' | 'tool' | 'error';

/** A message displayed as part of an agent run. */
export interface RenderMessage {
  role: RenderMessageRole;
  content: string;
}

/** Complete renderer input for the current agent-run state. */
export interface AgentRunView {
  title: string;
  prompt: string;
  mode: 'plain' | 'tui';
  status: AgentRunStatus;
  messages: RenderMessage[];
  files?: string[];
}

/** Common contract for terminal and plain-text renderers. */
export interface AgentRenderer {
  readonly kind: RendererKind;
  render(view: AgentRunView): Promise<void>;
}
