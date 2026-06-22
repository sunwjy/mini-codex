export type ModelRole = 'system' | 'user' | 'assistant';

/** A single conversational message sent to a model provider. */
export interface ModelMessage {
  role: ModelRole;
  content: string;
}

/** Provider-neutral input for one model generation. */
export interface ModelRequest {
  messages: ModelMessage[];
}

/** Incremental text and terminal completion events emitted by a provider. */
export type ModelStreamEvent =
  | {
      type: 'text.delta';
      delta: string;
    }
  | {
      type: 'message.completed';
      content: string;
    };

/** Contract implemented by streaming model backends. */
export interface ModelProvider {
  stream(request: ModelRequest): AsyncIterable<ModelStreamEvent>;
}
