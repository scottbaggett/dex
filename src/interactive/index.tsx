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
  return new Promise((resolve, reject) => {
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
  });
}