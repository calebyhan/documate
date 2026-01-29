import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { loadConfig, saveConfig, DEFAULT_CONFIG } from '../../utils/config.js';
import { renderHeader } from '../ui/components.js';
import { logger } from '../../utils/logger.js';

export async function configCommand(options: { init?: boolean; show?: boolean }): Promise<void> {
  if (options.init) {
    await initConfig();
    return;
  }

  if (options.show) {
    await showConfig();
    return;
  }

  // Default: show config
  await showConfig();
}

async function initConfig(): Promise<void> {
  console.log(renderHeader('DocuMate', 'Initialize Configuration'));

  const style = await select({
    message: 'Documentation style:',
    choices: [
      { name: 'JSDoc (recommended)', value: 'jsdoc' as const },
      { name: 'TSDoc', value: 'tsdoc' as const },
    ],
  });

  const config = {
    ...DEFAULT_CONFIG,
    documentation: {
      ...DEFAULT_CONFIG.documentation,
      style,
    },
  };

  await saveConfig(config);
  logger.success('Configuration saved to .documate.json');
  console.log(chalk.dim('\nYou can edit this file manually for more options.\n'));
}

async function showConfig(): Promise<void> {
  const config = await loadConfig();
  console.log(renderHeader('DocuMate', 'Configuration'));
  console.log(JSON.stringify(config, null, 2));
  console.log();
}
