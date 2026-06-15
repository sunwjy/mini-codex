import type { InteractionPort } from '../interaction/index.js';
import type { AgentRenderer, AgentRunView } from './types.js';

export interface PlainRendererOptions {
  interaction: InteractionPort;
}

export class PlainRenderer implements AgentRenderer {
  readonly kind = 'plain';
  readonly interaction: InteractionPort;

  constructor(options: PlainRendererOptions) {
    this.interaction = options.interaction;
  }

  async render(view: AgentRunView): Promise<void> {
    await this.interaction.write({
      content: `${view.title} (${view.mode})`,
      role: 'system',
    });
    await this.interaction.write({ content: `Prompt: ${view.prompt}`, role: 'system' });
    await this.interaction.write({ content: `Status: ${view.status}`, role: 'system' });

    for (const message of view.messages) {
      await this.interaction.write(message);
    }
  }
}
