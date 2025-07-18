import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { GitChange } from '../types';
import * as path from 'path';

interface FileSelectorProps {
  changes: GitChange[];
  onComplete: (selectedFiles: GitChange[], copyToClipboard?: boolean) => void;
  onCancel: () => void;
}

interface FileItem extends GitChange {
  selected: boolean;
}



interface DisplayItem {
  path: string;
  isHeader?: boolean;
  fileCount?: number;
  selected: boolean;
  mixed?: boolean;
  files?: FileItem[];
  // File properties (only for non-headers)
  status?: string;
  additions?: number;
  deletions?: number;
  lastModified?: Date | string;
  diff?: string;
  file?: string;
}

// Smart path truncation: keeps filename and shows partial path
function truncatePath(path: string, maxLength: number): string {
  if (path.length <= maxLength) return path;
  
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  
  if (filename.length > maxLength - 3) {
    return filename.substring(0, Math.max(10, maxLength - 6)) + '...';
  }
  
  if (maxLength < 20) {
    return filename.length > maxLength - 3 ? filename.substring(0, maxLength - 3) + '...' : filename;
  }
  
  let result = filename;
  let i = parts.length - 2;
  
  while (i >= 0 && result.length + parts[i].length + 4 < maxLength) {
    result = parts[i] + '/' + result;
    i--;
  }
  
  if (i >= 0) {
    const remainingSpace = maxLength - result.length - 4;
    if (remainingSpace > 0 && parts[i].length <= remainingSpace) {
      result = '.../' + parts[i] + '/' + result;
    } else {
      result = '.../' + result;
    }
  }
  
  return result;
}

// Format relative time
function formatRelativeTime(date: Date | string | undefined): string {
  if (!date) return '        ';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '        ';
  
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
  const [terminalSize, setTerminalSize] = useState({ 
    rows: process.stdout.rows || 24, 
    columns: process.stdout.columns || 80 
  });

  // Group files by directory and create display items
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>(() => {
    const files: FileItem[] = changes.map(change => ({ ...change, selected: false }));
    
    // Group files by directory
    const groupedFiles: Record<string, FileItem[]> = {};
    files.forEach(file => {
      const dir = path.dirname(file.file);
      const normalizedDir = dir === '.' ? 'root' : dir;
      if (!groupedFiles[normalizedDir]) {
        groupedFiles[normalizedDir] = [];
      }
      groupedFiles[normalizedDir].push(file);
    });

    // Create display items with headers
    const items: DisplayItem[] = [];
    const sortedDirs = Object.keys(groupedFiles).sort();
    
    for (const dir of sortedDirs) {
      const dirFiles = groupedFiles[dir];
      const allSelected = dirFiles.every(f => f.selected);
      const someSelected = dirFiles.some(f => f.selected);
      
      // Add directory header
      items.push({
        path: dir === 'root' ? '.' : dir,
        isHeader: true,
        fileCount: dirFiles.length,
        selected: allSelected,
        mixed: someSelected && !allSelected,
        files: dirFiles
      });
      
      // Add files in this directory
      dirFiles.forEach(file => {
        items.push({
          ...file,
          path: file.file,
          selected: file.selected
        });
      });
    }
    
    return items;
  });

  const [cursor, setCursor] = useState(0);
  const [stats, setStats] = useState({
    selectedCount: 0,
    totalAdditions: 0,
    totalDeletions: 0,
    estimatedTokens: 0
  });

  // Calculate stats when selection changes
  useEffect(() => {
    const selectedFiles = displayItems.filter(item => !item.isHeader && item.selected);
    const totalAdditions = selectedFiles.reduce((sum, f) => sum + (f.additions || 0), 0);
    const totalDeletions = selectedFiles.reduce((sum, f) => sum + (f.deletions || 0), 0);
    const estimatedTokens = Math.ceil((totalAdditions + totalDeletions) * 80 / 4);
    
    setStats({
      selectedCount: selectedFiles.length,
      totalAdditions,
      totalDeletions,
      estimatedTokens
    });
  }, [displayItems]);

  // Handle terminal resize
  useEffect(() => {
    const handleResize = () => {
      const rows = Math.min(process.stdout.rows || 24, 30);
      const columns = Math.min(process.stdout.columns || 80, 120);
      setTerminalSize({ rows, columns });
    };

    handleResize();
    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);

  // Update directory header states when files change
  const updateDirectoryStates = (items: DisplayItem[]) => {
    return items.map(item => {
      if (item.isHeader && item.files) {
        const allSelected = item.files.every(f => f.selected);
        const someSelected = item.files.some(f => f.selected);
        return {
          ...item,
          selected: allSelected,
          mixed: someSelected && !allSelected
        };
      }
      return item;
    });
  };

  useInput((input, key) => {
    if (key.escape || input === 'q' || input === 'Q') {
      onCancel();
      exit();
      return;
    }

    if (key.return) {
      // Confirm selection
      const selectedFiles = displayItems
        .filter(item => !item.isHeader && item.selected)
        .map(item => {
          const { selected, isHeader, fileCount, mixed, files, ...change } = item;
          return change as GitChange;
        });
      onComplete(selectedFiles, false);
      exit();
      return;
    }

    if (input === 'c' || input === 'C') {
      // Copy to clipboard
      const selectedFiles = displayItems
        .filter(item => !item.isHeader && item.selected)
        .map(item => {
          const { selected, isHeader, fileCount, mixed, files, ...change } = item;
          return change as GitChange;
        });
      onComplete(selectedFiles, true);
      exit();
      return;
    }

    if (key.upArrow || input === 'k' || input === 'K') {
      setCursor(prev => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow || input === 'j' || input === 'J') {
      setCursor(prev => Math.min(displayItems.length - 1, prev + 1));
      return;
    }

    if (key.tab && !key.shift) {
      // Jump to next directory
      const headerIndices = displayItems
        .map((item, index) => item.isHeader ? index : -1)
        .filter(index => index !== -1);
      
      const currentHeaderIndex = headerIndices.findIndex(index => index > cursor);
      if (currentHeaderIndex !== -1) {
        setCursor(headerIndices[currentHeaderIndex]);
      } else if (headerIndices.length > 0) {
        // Wrap to first directory
        setCursor(headerIndices[0]);
      }
      return;
    }

    if (key.tab && key.shift) {
      // Jump to previous directory
      const headerIndices = displayItems
        .map((item, index) => item.isHeader ? index : -1)
        .filter(index => index !== -1);
      
      const reversedIndices = [...headerIndices].reverse();
      const currentHeaderIndex = reversedIndices.findIndex(index => index < cursor);
      if (currentHeaderIndex !== -1) {
        setCursor(reversedIndices[currentHeaderIndex]);
      } else if (headerIndices.length > 0) {
        // Wrap to last directory
        setCursor(headerIndices[headerIndices.length - 1]);
      }
      return;
    }

    if (input === ' ') {
      const currentItem = displayItems[cursor];
      
      if (currentItem.isHeader) {
        // Find all files in this directory from current displayItems
        const directoryPath = currentItem.path === '.' ? 'root' : currentItem.path;
        const filesInDirectory = displayItems.filter(item => 
          !item.isHeader && 
          (path.dirname(item.path) === directoryPath || 
           (directoryPath === 'root' && path.dirname(item.path) === '.'))
        );
        
        // Toggle all files in directory based on current selection state
        const allSelected = filesInDirectory.every(f => f.selected);
        const newSelection = !allSelected;
        
        setDisplayItems(prev => {
          const updated = prev.map(item => {
            if (item.isHeader) return item;
            // Check if this file belongs to the current directory
            const itemDir = path.dirname(item.path);
            const normalizedItemDir = itemDir === '.' ? 'root' : itemDir;
            if (normalizedItemDir === directoryPath) {
              return { ...item, selected: newSelection };
            }
            return item;
          });
          return updateDirectoryStates(updated);
        });
      } else if (!currentItem.isHeader) {
        // Toggle single file
        setDisplayItems(prev => {
          const updated = prev.map((item, index) => {
            if (index === cursor) {
              return { ...item, selected: !item.selected };
            }
            return item;
          });
          return updateDirectoryStates(updated);
        });
      }
      return;
    }

    if (input === 'a' || input === 'A') {
      setDisplayItems(prev => {
        const updated = prev.map(item => ({ ...item, selected: true }));
        return updateDirectoryStates(updated);
      });
      return;
    }

    if (input === 'n' || input === 'N') {
      setDisplayItems(prev => {
        const updated = prev.map(item => ({ ...item, selected: false }));
        return updateDirectoryStates(updated);
      });
      return;
    }
  });

  return (
    <Box flexDirection="column" width="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text color="cyan">DEX Interactive Mode</Text>
        <Text color="gray"> - {changes.length} files changed</Text>
      </Box>
      
      {/* Instructions */}
      <Box paddingX={1} marginY={1}>
        <Text color="white">Select files to include in extraction</Text>
        <Text color="gray"> [Directory headers select all files in that directory]</Text>
      </Box>

      {/* File list */}
      <Box flexDirection="column" paddingX={1}>
        {(() => {
          // Calculate pagination
          const headerHeight = 6;
          const maxVisibleItems = Math.max(5, terminalSize.rows - headerHeight);
          const startIndex = Math.max(0, Math.min(cursor - Math.floor(maxVisibleItems / 2), displayItems.length - maxVisibleItems));
          const endIndex = Math.min(displayItems.length, startIndex + maxVisibleItems);
          const visibleItems = displayItems.slice(startIndex, endIndex);
          
          return visibleItems.map((item, visibleIndex) => {
            const actualIndex = startIndex + visibleIndex;
            const isActive = actualIndex === cursor;
            
            if (item.isHeader) {
              // Directory header
              const headerText = `${item.path}/ (${item.fileCount} files)`;
              const selectionIcon = item.selected ? '[x]' : item.mixed ? '[■]' : '[□]';
              
              const headerColor = item.selected || item.mixed ? 'green' : 'white';

              return (
                <Box key={`header-${item.path}`}>
                  <Text color={isActive ? 'cyan' : 'white'}>
                    {isActive ? '>' : ' '}
                  </Text>
                  <Text color={headerColor}>
                    {selectionIcon}
                  </Text>
                  <Text> </Text>
                  <Text color={isActive ? 'cyan' : headerColor} bold>
                    {headerText}
                  </Text>
                  <Text color="gray"> ────── all</Text>
                </Box>
              );
            } else {
              // File item
              const textColor = item.selected ? 'green' : 'white';
              const pathWidth = Math.min(45, Math.max(25, terminalSize.columns - 30));
              const truncatedPath = truncatePath(item.path, pathWidth);
              const timeAgo = formatRelativeTime(item.lastModified);
              const statusChar = (item.status || 'unknown').charAt(0).toUpperCase();
              const additions = (item.additions || 0).toString();
              const deletions = (item.deletions || 0).toString();
              
              return (
                <Box key={item.path}>
                  <Text color={isActive ? 'cyan' : textColor}>
                    {isActive ? '>' : ' '}
                  </Text>
                  <Text color={item.selected ? 'green' : 'gray'} bold={item.selected}>
                    [{item.selected ? '✓' : ' '}]
                  </Text>
                  <Text> </Text>
                  <Text color={isActive ? (item.selected ? 'green' : 'cyan') : textColor} bold={item.selected}>
                    {'  ' + truncatedPath.padEnd(pathWidth)}
                  </Text>
                  <Text color={textColor}>{` ${statusChar} `}</Text>
                  <Text color={textColor}>{`+${additions.padStart(3)}`}</Text>
                  <Text color={textColor}>{`-${deletions.padStart(3)}`}</Text>
                  <Text color={textColor}>{` ${timeAgo.padStart(7)}`}</Text>
                </Box>
              );
            }
          });
        })()}
      </Box>

      {/* Status bar */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text>
          {`Selected: ${stats.selectedCount} files | ${stats.totalAdditions} additions | ${stats.totalDeletions} deletions | ~${(stats.estimatedTokens / 1000).toFixed(1)}K tokens`}
        </Text>
        {displayItems.length > 10 && (
          <Text color="gray">
            {` | ${cursor + 1}/${displayItems.length}`}
          </Text>
        )}
      </Box>

      {/* Help */}
      <Box paddingX={1} marginTop={1}>
        <Text color="cyan">↑↓/jk</Text>
        <Text color="whiteBright"> navigate | </Text>
        <Text color="cyan">TAB</Text>
        <Text color="whiteBright"> next dir | </Text>
        <Text color="cyan">⇧TAB</Text>
        <Text color="whiteBright"> prev dir | </Text>
        <Text color="cyan">SPACE</Text>
        <Text color="whiteBright"> select | </Text>
        <Text color="cyan">a</Text>
        <Text color="whiteBright"> all | </Text>
        <Text color="cyan">n</Text>
        <Text color="whiteBright"> none | </Text>
        <Text color="cyan">c</Text>
        <Text color="whiteBright"> copy | </Text>
        <Text color="cyan">ENTER</Text>
        <Text color="whiteBright"> confirm | </Text>
        <Text color="cyan">ESC</Text>
        <Text color="whiteBright"> cancel</Text>
      </Box>
    </Box>
  );
};

export default FileSelector;
export { truncatePath, formatRelativeTime };