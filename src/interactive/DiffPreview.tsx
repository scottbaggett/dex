import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { FileItem } from './types';

interface DiffPreviewProps {
  file: FileItem;
  scrollOffset: number;
  maxHeight: number;
}

const DiffPreview: React.FC<DiffPreviewProps> = ({ file, scrollOffset, maxHeight }) => {
  // Get the content to display - use diff if available, otherwise raw content for new files
  const contentToDisplay = file.diff || '';
  
  // Memoize the split operation to avoid re-splitting on every render/scroll
  const allLines = useMemo(() => contentToDisplay.split('\n'), [contentToDisplay]);
  
  // Calculate visible lines based on terminal height
  const contentHeight = Math.max(1, maxHeight - 6); // Reserve space for header/footer
  const visibleLines = allLines.slice(scrollOffset, scrollOffset + contentHeight);
  
  // Check if we have content
  const hasContent = contentToDisplay.trim() !== '';

  return (
    <Box flexDirection="column" width="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text color={file.selected ? 'green' : 'gray'}>
          {file.selected ? '[✓] ' : '[ ] '}
        </Text>
        <Text color="cyan">File Preview: </Text>
        <Text color="whiteBright">{file.file}</Text>
        <Text color="gray"> ({file.status})</Text>
      </Box>

      {/* Selection status */}
      <Box paddingX={1}>
        {file.selected ? (
          <Text color="green">  SELECTED</Text>
        ) : (
          <Text color="gray">  Not selected</Text>
        )}
      </Box>

      {/* Diff Content */}
      <Box flexDirection="column" paddingX={1} marginTop={1}>
        {!hasContent ? (
          <Box flexDirection="column">
            <Text color="yellow">No diff available for this file.</Text>
            {file.status === 'added' && (
              <Text color="gray">This is a new/untracked file.</Text>
            )}
            {file.status === 'deleted' && (
              <Text color="gray">This file has been deleted.</Text>
            )}
            <Box marginTop={1}>
              <Text color="white">File: {file.file}</Text>
            </Box>
            <Text color="gray">Status: {file.status} | +{file.additions || 0} lines</Text>
          </Box>
        ) : (
          // Map each line and ensure it's wrapped in Text
          visibleLines.map((line, index) => {
            let lineColor = 'white';
            
            // Determine line color based on diff markers
            if (line.startsWith('+') && !line.startsWith('+++')) {
              lineColor = 'green';
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              lineColor = 'red';
            } else if (line.startsWith('@@')) {
              lineColor = 'cyan';
            } else if (line.startsWith('+++') || line.startsWith('---')) {
              lineColor = 'gray';
            }
            
            // THE KEY FIX: Every line, including empty ones, is wrapped in <Text>
            return (
              <Text key={`line-${scrollOffset + index}`} color={lineColor}>
                {line || ' '} {/* Ensure empty lines render as a space */}
              </Text>
            );
          })
        )}
      </Box>
      
      {/* Scroll indicator */}
      {hasContent && allLines.length > contentHeight && (
        <Box marginTop={1}>
          <Text color="gray">
            {`Lines ${scrollOffset + 1}-${Math.min(scrollOffset + visibleLines.length, allLines.length)} of ${allLines.length}`}
          </Text>
          {scrollOffset > 0 && (
            <Text color="gray"> (↑ to scroll up)</Text>
          )}
          {scrollOffset + visibleLines.length < allLines.length && (
            <Text color="gray"> (↓ to scroll down)</Text>
          )}
        </Box>
      )}
      
      {/* Help */}
      <Box paddingX={1} marginTop={1}>
        <Text color="cyan">↑↓</Text>
        <Text color="whiteBright"> scroll | </Text>
        <Text color="cyan">SPACE</Text>
        <Text color="whiteBright"> </Text>
        {file.selected ? (
          <Text color="green">deselect</Text>
        ) : (
          <Text color="yellow">select</Text>
        )}
        <Text color="whiteBright"> | </Text>
        <Text color="cyan">ESC</Text>
        <Text color="whiteBright"> back to list</Text>
      </Box>
    </Box>
  );
};

export default DiffPreview;