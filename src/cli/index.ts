#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { scanCommand } from './commands/scan.js';
import { healthCommand } from './commands/health.js';
import { driftCommand } from './commands/drift.js';
import { fixCommand } from './commands/fix.js';
import { generateCommand } from './commands/generate.js';
import { chatCommand } from './commands/chat.js';
import { configCommand } from './commands/config.js';
import { setExplainMode } from '../copilot/wrapper.js';
import { metrics } from '../utils/metrics.js';

const program = new Command();

program
  .name('documate')
  .description('AI-powered documentation assistant')
  .version('0.1.0')
  .option('--no-color', 'Disable colors')
  .option('--explain', 'Show Copilot prompts and responses for transparency')
  .option('--stats', 'Show session metrics after command execution')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.explain) {
      setExplainMode(true);
    }
  })
  .hook('postAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.stats) {
      console.log(chalk.dim('\n' + '─'.repeat(60)));
      console.log(metrics.getSummary());
    }
  });

program
  .command('scan')
  .description('Scan codebase for documentation issues')
  .argument('[path]', 'Path to scan', '.')
  .option('--verbose', 'Show detailed output')
  .option('--json', 'Output as JSON')
  .action(scanCommand);

program
  .command('health')
  .description('Check documentation health')
  .option('--verbose', 'Show detailed output')
  .action(healthCommand);

program
  .command('drift')
  .description('Detect documentation drift')
  .option('-f, --file <path>', 'Analyze a specific file')
  .option('--commits <number>', 'Number of commits to analyze', '10')
  .option('--since <date>', 'Check drift since specific date')
  .option('--verbose', 'Show detailed output')
  .action(driftCommand);

program
  .command('fix')
  .description('Fix documentation issues')
  .option('-i, --interactive', 'Interactive fix session')
  .option('--verbose', 'Show detailed output')
  .action(fixCommand);

program
  .command('generate')
  .description('Generate documentation')
  .argument('<target>', 'File or file:function to document')
  .option('-s, --style <style>', 'Documentation style', 'jsdoc')
  .option('-t, --type <type>', 'Generation type (api, architecture, markdown)')
  .option('-i, --interactive', 'Interactive generation')
  .option('--verbose', 'Show detailed output')
  .action(generateCommand);

program
  .command('chat')
  .description('Chat about documentation with Copilot')
  .action(chatCommand);

program
  .command('config')
  .description('Manage configuration')
  .option('--init', 'Initialize configuration')
  .option('--show', 'Show current configuration')
  .action(configCommand);

program.parse();
