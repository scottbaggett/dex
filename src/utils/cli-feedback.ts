import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { AIAnalysisResult } from '../types/ai-context';

export interface ProgressOptions {
  text: string;
  color?: 'cyan' | 'green' | 'yellow' | 'red' | 'blue';
}

export class CLIFeedback {
  private spinner: Ora | null = null;
  
  /**
   * Start a progress indicator
   */
  startProgress(options: ProgressOptions): void {
    this.spinner = ora({
      text: options.text,
      color: options.color || 'cyan'
    }).start();
  }
  
  /**
   * Update progress text
   */
  updateProgress(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }
  
  /**
   * Complete progress with success
   */
  succeedProgress(text: string): void {
    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = null;
    }
  }
  
  /**
   * Complete progress with failure
   */
  failProgress(text: string): void {
    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = null;
    }
  }
  
  /**
   * Complete progress with warning
   */
  warnProgress(text: string): void {
    if (this.spinner) {
      this.spinner.warn(text);
      this.spinner = null;
    }
  }
  
  /**
   * Stop progress without message
   */
  stopProgress(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }
  
  /**
   * Display analysis summary with enhanced formatting
   */
  displayAnalysisSummary(result: AIAnalysisResult, showFiles: boolean = true): void {
    const { summary, selections } = result;
    
    // Main summary header
    console.log(chalk.cyan('\n📊 Analysis Summary'));
    console.log(chalk.white('═'.repeat(50)));
    
    // Statistics
    console.log(chalk.white(`📁 Total Files Scanned: ${summary.totalFiles}`));
    console.log(chalk.white(`✅ Files Selected: ${summary.selectedFiles}`));
    console.log(chalk.white(`🎯 Selection Rate: ${Math.round((summary.selectedFiles / summary.totalFiles) * 100)}%`));
    
    // Priority breakdown with visual indicators
    console.log(chalk.cyan('\n🎯 Priority Breakdown:'));
    console.log(chalk.white('─'.repeat(40)));
    
    const priorityData = [
      { level: 'High', count: summary.highPriorityCount, icon: '🔴', color: chalk.red },
      { level: 'Medium', count: summary.mediumPriorityCount, icon: '🟠', color: chalk.yellow },
      { level: 'Low', count: summary.lowPriorityCount, icon: '🔵', color: chalk.blue }
    ];
    
    for (const priority of priorityData) {
      if (priority.count > 0) {
        const percentage = Math.round((priority.count / summary.selectedFiles) * 100);
        const bar = this.createProgressBar(percentage, 20);
        console.log(
          `${priority.icon} ${priority.color(priority.level.padEnd(6))}: ${priority.count.toString().padStart(2)} files ${bar} ${percentage}%`
        );
      }
    }
    
    // Token and cost information
    console.log(chalk.cyan('\n💾 Resource Estimates:'));
    console.log(chalk.white('─'.repeat(40)));
    
    const tokenStr = summary.totalTokens >= 1000 
      ? `${(summary.totalTokens / 1000).toFixed(1)}k tokens` 
      : `${summary.totalTokens} tokens`;
    console.log(chalk.white(`📊 Total Tokens: ${tokenStr}`));
    
    if (summary.estimatedCost > 0) {
      const costStr = summary.estimatedCost < 0.01 
        ? `$${(summary.estimatedCost * 100).toFixed(2)}¢`
        : `$${summary.estimatedCost.toFixed(4)}`;
      console.log(chalk.white(`💰 Estimated Cost: ${costStr}`));
    }
    
    // Show selected files if requested
    if (showFiles && selections.length > 0) {
      console.log(chalk.cyan('\n📋 Selected Files:'));
      console.log(chalk.white('─'.repeat(40)));
      
      const filesByPriority = {
        high: selections.filter(s => s.priority === 'high'),
        medium: selections.filter(s => s.priority === 'medium'),
        low: selections.filter(s => s.priority === 'low')
      };
      
      for (const [priority, files] of Object.entries(filesByPriority)) {
        if (files.length === 0) continue;
        
        const priorityIcon = priority === 'high' ? '🔴' : priority === 'medium' ? '🟠' : '🔵';
        const priorityColor = priority === 'high' ? chalk.red : priority === 'medium' ? chalk.yellow : chalk.blue;
        
        console.log(priorityColor(`\n${priorityIcon} ${priority.toUpperCase()} PRIORITY:`));
        
        for (const file of files.slice(0, 10)) { // Show max 10 files per priority
          const tokenStr = file.tokenEstimate >= 1000 
            ? `${Math.round(file.tokenEstimate / 1000)}k` 
            : `${file.tokenEstimate}`;
          console.log(chalk.white(`  ✓ ${file.file}`) + chalk.dim(` (${tokenStr} tokens)`));
          
          if (file.reason) {
            const truncatedReason = file.reason.length > 80 
              ? file.reason.substring(0, 77) + '...'
              : file.reason;
            console.log(chalk.gray(`    → ${truncatedReason}`));
          }
        }
        
        if (files.length > 10) {
          console.log(chalk.dim(`    ... and ${files.length - 10} more files`));
        }
      }
    }
    
    console.log(chalk.white('═'.repeat(50)));
  }
  
  /**
   * Create a visual progress bar
   */
  private createProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  }
  
  /**
   * Display a confirmation prompt with enhanced formatting
   */
  async confirmAction(
    message: string, 
    details?: string[], 
    defaultYes: boolean = true
  ): Promise<boolean> {
    console.log(chalk.cyan(`\n❓ ${message}`));
    
    if (details && details.length > 0) {
      console.log(chalk.white('─'.repeat(40)));
      for (const detail of details) {
        console.log(chalk.white(`  • ${detail}`));
      }
      console.log(chalk.white('─'.repeat(40)));
    }
    
    const { default: readline } = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const prompt = defaultYes ? '[Y/n]' : '[y/N]';
    const question = chalk.blue(`Continue? ${prompt} `);
    
    return new Promise<boolean>((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        
        const normalizedAnswer = answer.toLowerCase().trim();
        
        if (normalizedAnswer === '') {
          resolve(defaultYes);
        } else if (normalizedAnswer === 'y' || normalizedAnswer === 'yes') {
          resolve(true);
        } else if (normalizedAnswer === 'n' || normalizedAnswer === 'no') {
          resolve(false);
        } else {
          resolve(defaultYes);
        }
      });
    });
  }
  
  /**
   * Display a success message with formatting
   */
  displaySuccess(message: string, details?: string[]): void {
    console.log(chalk.green(`\n✅ ${message}`));
    
    if (details && details.length > 0) {
      for (const detail of details) {
        console.log(chalk.dim(`   ${detail}`));
      }
    }
  }
  
  /**
   * Display an error message with formatting
   */
  displayError(message: string, error?: Error): void {
    console.log(chalk.red(`\n❌ ${message}`));
    
    if (error) {
      console.log(chalk.dim(`   ${error.message}`));
    }
  }
  
  /**
   * Display a warning message with formatting
   */
  displayWarning(message: string, details?: string[]): void {
    console.log(chalk.yellow(`\n⚠️  ${message}`));
    
    if (details && details.length > 0) {
      for (const detail of details) {
        console.log(chalk.dim(`   ${detail}`));
      }
    }
  }
}