import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import ora from 'ora';
import cliProgress from 'cli-progress';

export function renderHeader(title: string, subtitle?: string): string {
  const gradientTitle = gradient.pastel.multiline(title);
  const content = subtitle
    ? `${gradientTitle}\n${chalk.gray(subtitle)}`
    : gradientTitle;

  return boxen(content, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan',
    textAlignment: 'center',
  });
}

export function createProgressBar(title: string): cliProgress.SingleBar {
  return new cliProgress.SingleBar({
    format: `${chalk.cyan('🔍')} ${title} | ${chalk.bold('{bar}')} | {percentage}% | {value}/{total}`,
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
  });
}

export function createSpinner(message: string): ReturnType<typeof ora> {
  return ora({
    text: chalk.cyan(`🤖 ${message}`),
    spinner: 'dots',
  });
}

export function renderHealthScore(score: number): string {
  const emoji = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
  const color = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;

  const barLength = 20;
  const filled = Math.round((score / 100) * barLength);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

  return boxen(
    `\n${color.bold(score.toString())} ${emoji}\n${color('/100')}\n\n${color(bar)}`,
    {
      padding: 1,
      textAlignment: 'center',
      borderStyle: 'round',
      borderColor: score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red',
    },
  );
}

export function renderProgressBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const color = percentage >= 80 ? chalk.green : percentage >= 60 ? chalk.yellow : chalk.red;
  return color(bar);
}

export function renderPriorityBadge(priority: 'critical' | 'high' | 'medium' | 'low'): string {
  const badges: Record<string, string> = {
    critical: chalk.red.bold('🔴 CRITICAL'),
    high: chalk.yellow.bold('🟡 HIGH'),
    medium: chalk.blue.bold('🔵 MEDIUM'),
    low: chalk.gray('⚪ LOW'),
  };
  return badges[priority] ?? priority;
}

export function renderError(error: Error | string, context?: string): void {
  const message = typeof error === 'string' ? error : error.message;
  console.log(
    '\n' +
      boxen(
        `${chalk.red.bold('Error')}\n\n${chalk.red(message)}${context ? '\n\n' + chalk.dim(context) : ''}`,
        {
          padding: 1,
          borderColor: 'red',
          borderStyle: 'round',
        },
      ) +
      '\n',
  );
}

export function renderWarning(message: string): void {
  console.log(
    '\n' +
      boxen(`${chalk.yellow.bold('Warning')}\n\n${chalk.yellow(message)}`, {
        padding: 1,
        borderColor: 'yellow',
        borderStyle: 'round',
      }) +
      '\n',
  );
}

export function renderDriftMeter(score: number): string {
  const level = score <= 3 ? 'low' : score <= 6 ? 'medium' : score <= 8 ? 'high' : 'critical';
  const colorMap = {
    low: chalk.green,
    medium: chalk.blue,
    high: chalk.yellow,
    critical: chalk.red.bold,
  };
  const labels = {
    low: '🟢 Low Drift',
    medium: '🔵 Medium Drift',
    high: '🟡 High Drift',
    critical: '🔴 Critical Drift',
  };
  return colorMap[level](`${score}/10 - ${labels[level]}`);
}
