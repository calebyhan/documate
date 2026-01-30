import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import chalk from 'chalk';
import { input, select } from '@inquirer/prompts';
import { TypeScriptScanner } from '../../core/scanners/typescript-scanner.js';
import { DocGenerator } from '../../core/generators/doc-generator.js';
import { CopilotWrapper } from '../../copilot/wrapper.js';
import { createSpinner, renderHeader } from '../ui/components.js';
import { logger, setVerbose } from '../../utils/logger.js';

export async function generateCommand(
  target: string,
  options: { style?: string; interactive?: boolean; verbose?: boolean },
): Promise<void> {
  if (options.verbose) {
    setVerbose(true);
  }

  // Parse target: file.ts or file.ts:functionName
  const [filePart, functionName] = target.split(':');
  const filePath = resolve(filePart);
  const style = options.style ?? 'jsdoc';

  console.log(renderHeader('DocuMate', 'Generate Documentation'));

  // Scan the file
  const scanner = new TypeScriptScanner();
  const result = await scanner.scanFile(filePath);

  let functions = result.functions.filter((f) => !f.hasDocumentation);
  if (functionName) {
    functions = result.functions.filter((f) => f.name === functionName);
    if (functions.length === 0) {
      logger.error(`Function "${functionName}" not found in ${filePart}`);
      return;
    }
  }

  if (functions.length === 0) {
    logger.success('All functions are already documented!');
    return;
  }

  // Set up Copilot
  const copilot = new CopilotWrapper();
  const prereqs = await copilot.checkPrerequisites();
  const generator = new DocGenerator(prereqs.ok ? copilot : undefined);

  if (!prereqs.ok) {
    logger.warn('Copilot not available. Using template generation.');
  }

  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const fn of functions) {
    console.log(chalk.bold(`\n📝 ${fn.name}(${fn.params.map((p) => p.name).join(', ')})`));
    console.log(chalk.dim(`   ${filePart}:${fn.location.startLine}\n`));

    const spinner = createSpinner(`Generating docs for ${fn.name}`);
    spinner.start();

    // Extract function source code
    const fnCode = lines.slice(fn.location.startLine - 1, fn.location.endLine).join('\n');
    const doc = await generator.generateForFunction(fn, fnCode, style);

    spinner.succeed('Documentation generated!');

    console.log(chalk.green('\n--- Generated Documentation ---'));
    console.log(doc);
    console.log(chalk.green('-------------------------------\n'));

    if (options.interactive) {
      const action = await select({
        message: 'What would you like to do?',
        choices: [
          { name: 'Apply this documentation', value: 'apply' },
          { name: 'Skip this function', value: 'skip' },
          { name: 'Quit', value: 'quit' },
        ],
      });

      if (action === 'apply') {
        const insertLine = fn.location.startLine - 1;
        const indent = lines[insertLine]?.match(/^(\s*)/)?.[1] ?? '';
        const indentedDoc = doc.split('\n').map((l) => indent + l).join('\n');
        lines.splice(insertLine, 0, indentedDoc);
        await writeFile(filePath, lines.join('\n'));
        logger.success(`Documentation applied to ${fn.name}!`);
      } else if (action === 'quit') {
        break;
      }
    }
  }

  if (!options.interactive) {
    logger.info('Use --interactive (-i) to apply generated documentation');
  }
}
