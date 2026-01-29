import chalk from 'chalk';

let verboseEnabled = false;

export function setVerbose(enabled: boolean): void {
  verboseEnabled = enabled;
}

export const logger = {
  info(message: string): void {
    console.log(chalk.cyan('ℹ'), message);
  },

  success(message: string): void {
    console.log(chalk.green('✓'), message);
  },

  warn(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  },

  error(message: string): void {
    console.error(chalk.red('✗'), message);
  },

  debug(message: string): void {
    if (verboseEnabled) {
      console.log(chalk.gray('⋯'), chalk.gray(message));
    }
  },

  plain(message: string): void {
    console.log(message);
  },
};
