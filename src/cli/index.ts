#!/usr/bin/env node
import { Command } from 'commander';
import { scanCommand } from './commands/scan.js';
import { healthCommand } from './commands/health.js';
import { driftCommand } from './commands/drift.js';
import { fixCommand } from './commands/fix.js';
import { generateCommand } from './commands/generate.js';
import { chatCommand } from './commands/chat.js';
import { configCommand } from './commands/config.js';

const program = new Command();

program
  .name('documate')
  .description('AI-powered documentation assistant')
  .version('0.1.0')
  .option('--verbose', 'Show detailed output')
  .option('--json', 'Output as JSON')
  .option('--no-color', 'Disable colors');

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
  .option('--verbose', 'Show detailed output')
  .action(driftCommand);

program
  .command('fix')
  .description('Fix documentation issues')
  .option('-i, --interactive', 'Interactive fix session')
  .action(fixCommand);

program
  .command('generate')
  .description('Generate documentation')
  .argument('<target>', 'File or file:function to document')
  .option('-s, --style <style>', 'Documentation style', 'jsdoc')
  .option('-i, --interactive', 'Interactive generation')
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
