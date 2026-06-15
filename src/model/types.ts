export type ModelRole = 'system' | 'user' | 'assistant';

export interface ModelMessage {
  role: ModelRole;
  content: string;
}

export interface ModelRequest {
  messages: ModelMessage[];
}

export type ModelStreamEvent =
  | {
      type: 'text.delta';
      delta: string;
    }
  | {
      type: 'message.completed';
      content: string;
    };

export interface ModelProvider {
  stream(request: ModelRequest): AsyncIterable<ModelStreamEvent>;
}
