import chalk from 'chalk';
import { Help, Command } from 'commander';

/**
 * Custom help formatter for the root `dex` command.
 * Produces a concise, branded help banner with quick start and core flags.
 */
export class DexHelpFormatter extends Help {
  /**
   * Entry point Commander calls when someone types `dex --help`
   * @param cmd The root Command instance
   * @param helper The Help instance (unused)
   * @returns {string} The formatted help string
   */
  formatHelp(cmd: Command, helper: Help): string {
        const v = cmd.version() || '-';
    const lines: string[] = [];

    // Header
    lines.push(
      chalk.cyan.bold('\nDEX – AI-Powered Context Extraction for Code Changes'),
      chalk.gray(`v${v}\n`)
    );

    // Usage
    lines.push(chalk.yellow('USAGE'));
    lines.push('  dex [path|range] [flags]');
    lines.push('  dex <command> [sub-flags]\n');

    // Quick Start
    lines.push(chalk.yellow('QUICK START'));
    lines.push('  dex               Extract current unstaged changes');
    lines.push('  dex -s            Extract staged changes');
    lines.push('  dex HEAD~3        Extract last 3 commits');
    lines.push('  dex --task "Bug"  Add task context');
    lines.push('  dex distill .     Distill entire repo\n');

    // Core Options (hand-picked)
    lines.push(chalk.yellow('CORE FLAGS'));
    lines.push('  -s, --staged               only staged changes');
    lines.push('  -a, --all                  staged + unstaged');
    lines.push('  -f, --format <fmt>         markdown|json|xml');
    lines.push('  -c, --clipboard            copy to clipboard');
    lines.push('      --full <pattern>       include full files matching pattern');
    lines.push('      --select               interactive file picker');
    lines.push('      --task <src>           description / file / URL');
    lines.push('      --ai-action <type>     refactor|security|perf|...\n');

    // Sub commands
    lines.push(chalk.yellow('COMMANDS'));
    lines.push('  distill     Compress entire codebase');
    lines.push('  snapshot    Manage code snapshots');
    lines.push('  prompts     Prompt-template utilities\n');

    // Help routing
    lines.push(chalk.yellow('MORE'));
    lines.push('  dex --help-extended   full option list (original Commander)');
    lines.push('  dex help <command>    command-specific docs\n');

    // Footer
    lines.push(
      chalk.gray('\nDocs: https://github.com/browsercompany/dex'),
      chalk.gray('Copyright © Browser Company of New York')
    );

    return lines.join('\n');
  }
}