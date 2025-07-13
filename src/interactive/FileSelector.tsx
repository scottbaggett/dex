import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { FileItem, InteractiveState } from './types';
import { GitChange } from '../types';

interface FileSelectorProps {
  changes: GitChange[];
  onComplete: (selectedFiles: GitChange[]) => void;
  onCancel: () => void;
}

const FileSelector: React.FC<FileSelectorProps> = ({ changes, onComplete, onCancel }) => {
  const { exit } = useApp();
  
  const [state, setState] = useState<InteractiveState>(() => {
    const files = changes.map(change => ({ ...change, selected: false }));
    return {
      files,
      cursor: 0,
      selectedCount: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      estimatedTokens: 0,
    };
  });

  // Calculate stats when selection changes
  useEffect(() => {
    const selected = state.files.filter(f => f.selected);
    const totalAdditions = selected.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = selected.reduce((sum, f) => sum + f.deletions, 0);
    // Rough token estimate: ~1 token per 4 characters, ~80 chars per line
    const estimatedTokens = Math.ceil((totalAdditions + totalDeletions) * 80 / 4);
    
    setState(prev => ({
      ...prev,
      selectedCount: selected.length,
      totalAdditions,
      totalDeletions,
      estimatedTokens,
    }));
  }, [state.files]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      exit();
      return;
    }

    if (key.return) {
      const selectedFiles = state.files
        .filter(f => f.selected)
        .map(({ selected, ...change }) => change);
      onComplete(selectedFiles);
      exit();
      return;
    }

    if (key.upArrow) {
      setState(prev => ({
        ...prev,
        cursor: Math.max(0, prev.cursor - 1),
      }));
    }

    if (key.downArrow) {
      setState(prev => ({
        ...prev,
        cursor: Math.min(prev.files.length - 1, prev.cursor + 1),
      }));
    }

    if (input === ' ') {
      setState(prev => {
        const files = [...prev.files];
        files[prev.cursor].selected = !files[prev.cursor].selected;
        return { ...prev, files };
      });
    }

    if (input === 'a' || input === 'A') {
      setState(prev => ({
        ...prev,
        files: prev.files.map(f => ({ ...f, selected: true })),
      }));
    }

    if (input === 'n' || input === 'N') {
      setState(prev => ({
        ...prev,
        files: prev.files.map(f => ({ ...f, selected: false })),
      }));
    }
  });

  return (
    <Box flexDirection="column" width="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text color="cyan" bold>
          DEX Interactive Mode
        </Text>
        <Text color="gray"> - {state.files.length} files changed</Text>
      </Box>
      
      {/* Instructions */}
      <Box paddingX={1} marginY={1}>
        <Text color="gray">Select files to include in extraction [↑↓ Navigate]</Text>
      </Box>

      {/* File list */}
      <Box flexDirection="column" paddingX={1}>
        {state.files.map((file, index) => {
          const isActive = index === state.cursor;
          const statusColor = file.status === 'added' ? 'green' : 
                            file.status === 'deleted' ? 'red' : 'yellow';
          
          return (
            <Box key={file.file}>
              <Text color={isActive ? 'cyan' : 'white'}>
                {isActive ? '>' : ' '}
              </Text>
              <Text color={file.selected ? 'green' : 'gray'}>
                [{file.selected ? 'x' : ' '}]
              </Text>
              <Text> </Text>
              <Text color={isActive ? 'white' : 'gray'}>
                {file.file.padEnd(40)}
              </Text>
              <Text color={statusColor}>
                {file.status.charAt(0).toUpperCase().padEnd(3)}
              </Text>
              <Text color="green">
                +{file.additions.toString().padStart(4)}
              </Text>
              <Text color="red">
                -{file.deletions.toString().padStart(4)}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Status bar */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text>
          Selected: {state.selectedCount} files | 
          {' '}{state.totalAdditions} additions | 
          {' '}{state.totalDeletions} deletions | 
          {' '}~{(state.estimatedTokens / 1000).toFixed(1)}K tokens
        </Text>
      </Box>

      {/* Help */}
      <Box paddingX={1} marginTop={1}>
        <Text color="gray">
          SPACE select | a all | n none | ENTER confirm | ESC cancel
        </Text>
      </Box>
    </Box>
  );
};

export default FileSelector;