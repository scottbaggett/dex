import React from 'react';
import { render } from 'ink';
import FileSelector from './FileSelector';
import { GitChange } from '../types';

export interface InteractiveModeOptions {
  changes: GitChange[];
}

export async function launchInteractiveMode(
  options: InteractiveModeOptions
): Promise<GitChange[]> {
  return new Promise((resolve, reject) => {
    const app = render(
      <FileSelector
        changes={options.changes}
        onComplete={(selectedFiles) => {
          resolve(selectedFiles);
        }}
        onCancel={() => {
          reject(new Error('Interactive mode cancelled'));
        }}
      />
    );

    app.waitUntilExit().catch(reject);
  });
}