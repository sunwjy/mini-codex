export type RendererKind = 'ink' | 'plain';

export type AgentRunStatus = 'ready' | 'running' | 'completed' | 'failed';

export type RenderMessageRole = 'system' | 'assistant' | 'tool' | 'error';

export interface RenderMessage {
  role: RenderMessageRole;
  content: string;
}

export interface AgentRunView {
  title: string;
  prompt: string;
  mode: 'plain' | 'tui';
  status: AgentRunStatus;
  messages: RenderMessage[];
  files?: string[];
}

export interface AgentRenderer {
  readonly kind: RendererKind;
  render(view: AgentRunView): Promise<void>;
}
