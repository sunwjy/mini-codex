import type { ModelProvider, ModelRequest, ModelStreamEvent } from './types.js';

export interface FakeModelProviderOptions {
  chunks?: string[];
  error?: Error;
}

/** Deterministic model provider for tests and local smoke runs. */
export class FakeModelProvider implements ModelProvider {
  readonly chunks: string[];
  readonly error: Error | undefined;

  constructor(options: FakeModelProviderOptions = {}) {
    this.chunks = options.chunks ?? ['Fake response.'];
    this.error = options.error;
  }

  async *stream(_request: ModelRequest): AsyncIterable<ModelStreamEvent> {
    if (this.error) {
      throw this.error;
    }

    for (const chunk of this.chunks) {
      yield {
        type: 'text.delta',
        delta: chunk,
      };
    }

    // Completion mirrors the full text assembled by consumers from the deltas.
    yield {
      type: 'message.completed',
      content: this.chunks.join(''),
    };
  }
}
