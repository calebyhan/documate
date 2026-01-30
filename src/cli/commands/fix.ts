import { readFile, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { HealthCalculator } from '../../core/analyzers/health-calculator.js';
import { DocGenerator } from '../../core/generators/doc-generator.js';
import { CopilotWrapper } from '../../copilot/wrapper.js';
import { loadScanCache } from '../../utils/config.js';
import { runScan } from './scan.js';
import { renderHeader, renderPriorityBadge, createSpinner } from '../ui/components.js';
import { logger, setVerbose } from '../../utils/logger.js';
import type { ScanResult, DebtIssue } from '../../types/index.js';

export async function fixCommand(options: { interactive?: boolean; verbose?: boolean }): Promise<void> {
  if (options.verbose) {
    setVerbose(true);
  }

  let results = (await loadScanCache()) as ScanResult[] | null;
  if (!results) {
    logger.info('No cached scan results. Running scan first...\n');
    results = await runScan();
  }

  const calculator = new HealthCalculator();
  const health = calculator.calculateHealth(results);

  if (health.issues.length === 0) {
    console.log(renderHeader('DocuMate', 'Fix Documentation'));
    logger.success('No documentation issues found!');
    return;
  }

  if (!options.interactive) {
    console.log(renderHeader('DocuMate', 'Fix Documentation'));
    logger.info(`Found ${health.issues.length} issues.`);
    logger.info('Use --interactive (-i) for guided fix session.\n');

    // Show summary
    const counts = {
      critical: health.issues.filter((i) => i.severity === 'critical').length,
      high: health.issues.filter((i) => i.severity === 'high').length,
      medium: health.issues.filter((i) => i.severity === 'medium').length,
      low: health.issues.filter((i) => i.severity === 'low').length,
    };

    for (const [level, count] of Object.entries(counts)) {
      if (count > 0) {
        console.log(`  ${renderPriorityBadge(level as DebtIssue['severity'])}: ${count}`);
      }
    }
    console.log();
    return;
  }

  // Interactive fix session
  console.log(renderHeader('DocuMate', 'Interactive Fix Session'));
  console.log(chalk.dim(`Found ${health.issues.length} issues. Resolving in priority order.\n`));

  // Set up Copilot
  const copilot = new CopilotWrapper();
  const prereqs = await copilot.checkPrerequisites();
  const generator = new DocGenerator(prereqs.ok ? copilot : undefined);

  if (!prereqs.ok) {
    logger.warn(`Copilot: ${prereqs.error}`);
    logger.info('Using template-based suggestions.\n');
  }

  let applied = 0;
  let skipped = 0;

  for (let i = 0; i < health.issues.length; i++) {
    const issue = health.issues[i];
    const relFile = relative(process.cwd(), issue.file);

    console.log('━'.repeat(50));
    console.log(chalk.bold(`Issue ${i + 1} of ${health.issues.length}`));
    console.log(renderPriorityBadge(issue.severity));
    console.log('━'.repeat(50));

    console.log(chalk.cyan(`\n📁 ${relFile}`));
    console.log(chalk.cyan(`🔍 Function: ${issue.functionName}()`));
    console.log(chalk.yellow(`⚠  Problem: ${issue.reason}\n`));

    if (issue.suggestion) {
      console.log(chalk.dim(`🤖 ${issue.suggestion}\n`));
    }

    // Find the function in scan results and generate a fix
    const scanResult = results!.find((r) => r.file === issue.file);
    const fn = scanResult?.functions.find((f) => f.name === issue.functionName) ??
      scanResult?.classes.flatMap((c) => c.methods).find((m) => m.name === issue.functionName);

    if (fn) {
      const spinner = createSpinner('Generating fix suggestion');
      spinner.start();

      const content = await readFile(issue.file, 'utf-8');
      const fnCode = content.split('\n').slice(fn.location.startLine - 1, fn.location.endLine).join('\n');
      const doc = await generator.generateForFunction(fn, fnCode);

      spinner.succeed('Fix generated!');

      console.log(chalk.green('\n--- Suggested Fix ---'));
      console.log(doc);
      console.log(chalk.green('---------------------\n'));

      const action = await select({
        message: 'What would you like to do?',
        choices: [
          { name: '[A] Apply this fix', value: 'apply' },
          { name: '[S] Skip this issue', value: 'skip' },
          { name: '[Q] Quit session', value: 'quit' },
        ],
      });

      if (action === 'apply') {
        const lines = content.split('\n');
        const insertLine = fn.location.startLine - 1;
        const indent = lines[insertLine]?.match(/^(\s*)/)?.[1] ?? '';
        const indentedDoc = doc.split('\n').map((l) => indent + l).join('\n');
        lines.splice(insertLine, 0, indentedDoc);
        await writeFile(issue.file, lines.join('\n'));
        logger.success('Fix applied!\n');
        applied++;
      } else if (action === 'quit') {
        break;
      } else {
        skipped++;
        console.log(chalk.dim('⊘ Skipped\n'));
      }
    } else {
      skipped++;
      logger.warn('Could not locate function in source. Skipping.\n');
    }

    console.log(chalk.dim(`Progress: ${i + 1}/${health.issues.length} issues processed\n`));
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log(chalk.green.bold('Session Complete!'));
  console.log(`  Applied: ${chalk.green(applied.toString())}`);
  console.log(`  Skipped: ${chalk.yellow(skipped.toString())}`);
  console.log(chalk.cyan('\nRun "documate health" to see updated scores.\n'));
}
