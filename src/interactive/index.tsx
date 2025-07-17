import React from 'react';
import { render } from 'ink';
import FileSelector from './FileSelector';
import { GitChange } from '../types';

export interface InteractiveModeOptions {
  changes: GitChange[];
}

export interface InteractiveModeResult {
  files: GitChange[];
  copyToClipboard: boolean;
}

export async function launchInteractiveMode(
  options: InteractiveModeOptions
): Promise<InteractiveModeResult> {
  // Check if raw mode is supported
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Interactive mode requires a TTY terminal. Try running without --select or use a different terminal.');
  }

  return new Promise((resolve, reject) => {
    try {
      const app = render(
        <FileSelector
          changes={options.changes}
          onComplete={(selectedFiles, copyToClipboard = false) => {
            resolve({ files: selectedFiles, copyToClipboard });
          }}
          onCancel={() => {
            reject(new Error('Interactive mode cancelled'));
          }}
        />
      );

      app.waitUntilExit().catch(reject);
    } catch (error) {
      reject(new Error(`Interactive mode failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}