#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'prompts');
const distDir = path.join(__dirname, '..', 'dist', 'prompts');

// Create dist/prompts directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy all YAML/JSON files from src/prompts to dist/prompts
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml') || f.endsWith('.json'));

for (const file of files) {
  const srcPath = path.join(srcDir, file);
  const distPath = path.join(distDir, file);
  fs.copyFileSync(srcPath, distPath);
  console.log(`Copied ${file} to dist/prompts/`);
}

console.log(`\nCopied ${files.length} prompt templates to dist/prompts/`);