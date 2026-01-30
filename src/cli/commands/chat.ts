import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { CopilotWrapper } from '../../copilot/wrapper.js';
import { loadScanCache } from '../../utils/config.js';
import { renderHeader, createSpinner } from '../ui/components.js';
import { logger } from '../../utils/logger.js';
import type { ScanResult } from '../../types/index.js';
import { isCodeResult } from '../../types/index.js';

export async function chatCommand(): Promise<void> {
  console.log(renderHeader('DocuMate Chat', 'Powered by GitHub Copilot'));

  const copilot = new CopilotWrapper();
  const prereqs = await copilot.checkPrerequisites();

  if (!prereqs.ok) {
    logger.error(`Copilot is required for chat mode: ${prereqs.error}`);
    return;
  }

  // Load project context
  const scanResults = (await loadScanCache()) as ScanResult[] | null;
  let projectContext = 'No scan data available. Run "documate scan" first for context-aware chat.';

  if (scanResults) {
    const codeResults = scanResults.filter(isCodeResult);
    const totalFunctions = codeResults.reduce((s, r) => s + r.functions.length, 0);
    const documented = codeResults.reduce(
      (s, r) => s + r.functions.filter((f) => f.hasDocumentation).length,
      0,
    );
    const coverage = totalFunctions > 0 ? Math.round((documented / totalFunctions) * 100) : 100;

    projectContext = `Project has ${scanResults.length} files, ${totalFunctions} functions, ${coverage}% documentation coverage.`;
  }

  console.log(chalk.cyan('🤖 Hi! I\'m DocuMate, your AI documentation assistant.'));
  console.log(chalk.dim('   Ask me anything about your documentation!'));
  console.log(chalk.dim('   Type "exit" to quit.\n'));

  const history: Array<{ role: string; content: string }> = [];

  while (true) {
    let message: string;
    try {
      message = await input({ message: chalk.cyan('You:') });
    } catch {
      // Ctrl+C
      break;
    }

    if (!message.trim()) continue;

    if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') {
      console.log(chalk.cyan('\n🤖 Goodbye! Happy documenting!\n'));
      break;
    }

    const spinner = createSpinner('Thinking...');
    spinner.start();

    const enrichedPrompt = `You are DocuMate, an AI documentation assistant.
Project context: ${projectContext}

Recent conversation:
${history.slice(-4).map((h) => `${h.role}: ${h.content}`).join('\n')}

User: ${message}

Provide a helpful, conversational response about documentation best practices, the project's documentation health, or general guidance. Be concise.`;

    const response = await copilot.explain(enrichedPrompt);
    spinner.stop();

    if (response.success) {
      console.log(chalk.cyan('\n🤖 DocuMate:'));
      console.log(chalk.dim('   ' + response.raw.replace(/\n/g, '\n   ')) + '\n');
    } else {
      logger.error(`Copilot error: ${response.error}`);
    }

    history.push(
      { role: 'user', content: message },
      { role: 'assistant', content: response.raw },
    );
  }
}
