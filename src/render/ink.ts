import type { Instance, RenderOptions, RenderToStringOptions } from 'ink';
import { Box, render, renderToString, Text } from 'ink';
import React from 'react';
import type { AgentRenderer, AgentRunStatus, AgentRunView, RenderMessageRole } from './types.js';

export interface InkRendererOptions {
  input?: NodeJS.ReadStream;
  output?: NodeJS.WriteStream;
  errorOutput?: NodeJS.WriteStream;
  renderInk?: typeof render;
}

export class InkRenderer implements AgentRenderer {
  readonly kind = 'ink';
  readonly options: InkRendererOptions;

  constructor(options: InkRendererOptions = {}) {
    this.options = options;
  }

  async render(view: AgentRunView): Promise<void> {
    const renderInk = this.options.renderInk ?? render;
    const renderOptions: RenderOptions = {
      ...(this.options.errorOutput === undefined ? {} : { stderr: this.options.errorOutput }),
      ...(this.options.input === undefined ? {} : { stdin: this.options.input }),
      ...(this.options.output === undefined ? {} : { stdout: this.options.output }),
      exitOnCtrlC: true,
    };
    const instance: Instance = renderInk(renderInkView(view), renderOptions);

    await instance.waitUntilRenderFlush();
    instance.unmount();
    await instance.waitUntilExit();
  }
}

export function renderInkViewToString(
  view: AgentRunView,
  options: RenderToStringOptions = {},
): string {
  return renderToString(renderInkView(view), options);
}

function renderInkView(view: AgentRunView): React.ReactElement {
  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(Text, { bold: true, key: 'title' }, view.title),
    React.createElement(
      Text,
      { key: 'prompt' },
      React.createElement(Text, { color: 'cyan' }, 'Prompt: '),
      view.prompt,
    ),
    React.createElement(
      Text,
      { key: 'status' },
      React.createElement(Text, { color: statusColor(view.status) }, 'Status: '),
      view.status,
      React.createElement(Text, { dimColor: true }, ` / ${view.mode}`),
    ),
    view.files && view.files.length > 0
      ? React.createElement(
          Box,
          { flexDirection: 'column', key: 'files', marginTop: 1 },
          React.createElement(Text, { color: 'blue', key: 'files-title' }, 'Files'),
          ...view.files.map((file) =>
            React.createElement(
              Text,
              { key: file },
              React.createElement(Text, { dimColor: true }, '- '),
              file,
            ),
          ),
        )
      : null,
    React.createElement(
      Box,
      { flexDirection: 'column', key: 'messages', marginTop: 1 },
      ...view.messages.map((message, index) =>
        React.createElement(
          Text,
          { key: `${message.role}-${index}`, color: messageColor(message.role) },
          `${message.role}: ${message.content}`,
        ),
      ),
    ),
  );
}

function statusColor(status: AgentRunStatus): 'cyan' | 'green' | 'red' | 'yellow' {
  if (status === 'completed') {
    return 'green';
  }

  if (status === 'failed') {
    return 'red';
  }

  if (status === 'running') {
    return 'yellow';
  }

  return 'cyan';
}

function messageColor(role: RenderMessageRole): 'blue' | 'green' | 'red' | 'white' {
  if (role === 'assistant') {
    return 'green';
  }

  if (role === 'tool') {
    return 'blue';
  }

  if (role === 'error') {
    return 'red';
  }

  return 'white';
}
