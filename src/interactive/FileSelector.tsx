import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { InteractiveState } from './types';
import { GitChange } from '../types';
import DiffPreview from './DiffPreview';

interface FileSelectorProps {
  changes: GitChange[];
  onComplete: (selectedFiles: GitChange[], copyToClipboard?: boolean) => void;
  onCancel: () => void;
}

// Smart path truncation: keeps filename and shows partial path
function truncatePath(path: string, maxLength: number): string {
  if (path.length <= maxLength) return path;
  
  // Use forward slash for splitting as git always uses forward slashes
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  
  // If filename itself is too long, truncate it
  if (filename.length > maxLength - 3) {
    return '...' + filename.substring(filename.length - maxLength + 3);
  }
  
  // Try to show as much of the path as possible
  let result = filename;
  let i = parts.length - 2;
  
  while (i >= 0 && result.length + parts[i].length + 4 < maxLength) {
    result = parts[i] + '/' + result;
    i--;
  }
  
  if (i >= 0) {
    // Add ellipsis if we couldn't show the full path
    result = '.../' + result;
  }
  
  return result;
}

// Format relative time
function formatRelativeTime(date: Date | string | undefined): string {
  if (!date) return '        '; // 8 spaces to match padStart(8)
  
  // Convert string dates to Date objects
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '        '; // 8 spaces
  
  const now = new Date();
  const diff = now.getTime() - dateObj.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

const FileSelector: React.FC<FileSelectorProps> = ({ changes, onComplete, onCancel }) => {
  const { exit } = useApp();
  const [terminalSize, setTerminalSize] = useState({ rows: process.stdout.rows || 24, columns: process.stdout.columns || 80 });
  
  const [state, setState] = useState<InteractiveState>(() => {
    const files = changes.map(change => ({ ...change, selected: false }));
    return {
      files,
      cursor: 0,
      selectedCount: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      estimatedTokens: 0,
      previewFile: null,
      scrollOffset: 0,
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

  // Handle terminal resize
  useEffect(() => {
    const handleResize = () => {
      setTerminalSize({
        rows: process.stdout.rows || 24,
        columns: process.stdout.columns || 80
      });
    };

    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);

  useInput((input, key) => {
    // In preview mode
    if (state.previewFile) {
      if (key.escape) {
        setState(prev => ({ ...prev, previewFile: null, scrollOffset: 0 }));
        return;
      }
      
      if (key.upArrow) {
        setState(prev => ({
          ...prev,
          scrollOffset: Math.max(0, prev.scrollOffset - 1)
        }));
        return;
      }
      
      if (key.downArrow) {
        const diffLines = (state.previewFile.diff || '').split('\n').length;
        const maxScroll = Math.max(0, diffLines - (terminalSize.rows - 6));
        setState(prev => ({
          ...prev,
          scrollOffset: Math.min(maxScroll, prev.scrollOffset + 1)
        }));
        return;
      }
      
      if (input === ' ') {
        // Toggle selection in preview mode
        setState(prev => {
          const files = [...prev.files];
          const fileIndex = files.findIndex(f => f.file === prev.previewFile?.file);
          if (fileIndex >= 0) {
            files[fileIndex].selected = !files[fileIndex].selected;
            // Update the preview file to reflect the new selection state
            const updatedPreviewFile = { ...files[fileIndex] };
            return { ...prev, files, previewFile: updatedPreviewFile };
          }
          return { ...prev, files };
        });
        return;
      }
      
      return;
    }
    
    // Normal mode
    if (key.escape) {
      onCancel();
      exit();
      return;
    }

    if (key.return) {
      // Enter preview mode
      setState(prev => ({
        ...prev,
        previewFile: prev.files[prev.cursor],
        scrollOffset: 0
      }));
      return;
    }

    if (input === 'c' || input === 'C') {
      const selectedFiles = state.files
        .filter(f => f.selected)
        .map((file) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { selected, ...change } = file;
          return change;
        });
      onComplete(selectedFiles, true);
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

  // Show preview mode if active
  if (state.previewFile) {
    return (
      <DiffPreview 
        file={state.previewFile} 
        scrollOffset={state.scrollOffset}
        maxHeight={terminalSize.rows}
      />
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text color="cyan">DEX Interactive Mode</Text>
        <Text color="gray"> - {state.files.length} files changed</Text>
      </Box>
      
      {/* Instructions */}
      <Box paddingX={1} marginY={1}>
        <Text color="white">Select files to include in extraction</Text>
        <Text color="gray"> [↑↓ Navigate]</Text>
      </Box>

      {/* File list */}
      <Box flexDirection="column" paddingX={1}>
        {state.files.map((file, index) => {
          const isActive = index === state.cursor;
          const statusColor = file.status === 'added' ? 'green' : 
                            file.status === 'deleted' ? 'red' : 'yellow';
          const truncatedPath = truncatePath(file.file, 45) || 'unknown';
          const timeAgo = formatRelativeTime(file.lastModified);
          const statusChar = (file.status || 'unknown').charAt(0).toUpperCase() || 'U';
          const additions = (file.additions || 0).toString();
          const deletions = (file.deletions || 0).toString();
          
          return (
            <Box key={file.file}>
              <Text color={isActive ? 'cyan' : 'white'}>
                {isActive ? '>' : ' '}
              </Text>
              <Text color={file.selected ? 'green' : 'gray'}>
                [{file.selected ? '✓' : ' '}]
              </Text>
              <Text color="white"> </Text>
              <Text color={isActive ? 'white' : 'whiteBright'}>
                {truncatedPath.padEnd(45)}
              </Text>
              <Text color={statusColor}>
                {statusChar.padEnd(3)}
              </Text>
              <Text color="green">{`+${additions.padStart(4)}`}</Text>
              <Text color="red">{`-${deletions.padStart(4)}`}</Text>
              <Text color="blue">{` ${timeAgo.padStart(8)}`}</Text>
            </Box>
          );
        })}
      </Box>

      {/* Status bar */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text>
          {`Selected: ${state.selectedCount} files | ${state.totalAdditions} additions | ${state.totalDeletions} deletions | ~${(state.estimatedTokens / 1000).toFixed(1)}K tokens`}
        </Text>
      </Box>

      {/* Help */}
      <Box paddingX={1} marginTop={1}>
        <Text color="cyan">ENTER</Text>
        <Text color="whiteBright"> preview | </Text>
        <Text color="cyan">SPACE</Text>
        <Text color="whiteBright"> select | </Text>
        <Text color="cyan">a</Text>
        <Text color="whiteBright"> all | </Text>
        <Text color="cyan">n</Text>
        <Text color="whiteBright"> none | </Text>
        <Text color="cyan">c</Text>
        <Text color="whiteBright"> confirm+copy | </Text>
        <Text color="cyan">ESC</Text>
        <Text color="whiteBright"> cancel</Text>
      </Box>
    </Box>
  );
};

export default FileSelector;
export { truncatePath, formatRelativeTime };