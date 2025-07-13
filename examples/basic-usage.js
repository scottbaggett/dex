const { ContextEngine, MarkdownFormatter } = require('../dist');

async function main() {
  try {
    // Create context engine
    const engine = new ContextEngine();
    
    // Extract current changes
    console.log('Extracting current changes...');
    const context = await engine.extract({
      context: 'focused',
    });
    
    // Format as markdown
    const formatter = new MarkdownFormatter();
    const output = formatter.format({ 
      context, 
      options: { context: 'focused' } 
    });
    
    console.log('\n--- Output ---\n');
    console.log(output);
    
    // Show summary
    console.log('\n--- Summary ---');
    console.log(`Files changed: ${context.scope.filesChanged}`);
    console.log(`Lines added: ${context.scope.linesAdded}`);
    console.log(`Lines deleted: ${context.scope.linesDeleted}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();