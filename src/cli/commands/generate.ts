import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import chalk from 'chalk';
import { select, confirm } from '@inquirer/prompts';
import { ScannerRegistry } from '../../core/scanners/scanner-registry.js';
import { DocGenerator } from '../../core/generators/doc-generator.js';
import { MarkdownGenerator } from '../../core/generators/markdown-generator.js';
import { CopilotWrapper } from '../../copilot/wrapper.js';
import { createSpinner, renderHeader } from '../ui/components.js';
import { logger, setVerbose } from '../../utils/logger.js';
import { loadScanCache, loadConfig } from '../../utils/config.js';
import { runScan } from './scan.js';
import { metrics } from '../../utils/metrics.js';
import { isCodeResult } from '../../types/index.js';
import type { ScanResult } from '../../types/index.js';

/**
 * generateCommand - Generate documentation for code or markdown files
 *
 * @param {string} target - File path (e.g., file.ts:functionName or docs/api.md)
 * @param {{ style?: string; interactive?: boolean; verbose?: boolean; type?: string }} options - Generation options
 * @returns {Promise<void>}
 */
export async function generateCommand(
  target: string,
  options: { style?: string; interactive?: boolean; verbose?: boolean; type?: string },
): Promise<void> {
  if (options.verbose) {
    setVerbose(true);
  }

  console.log(renderHeader('DocuMate', 'Generate Documentation'));

  // Check if this is markdown generation
  if (target.endsWith('.md') || options.type === 'markdown') {
    await generateMarkdownDocs(target, options);
    return;
  }

  // Code generation (existing functionality)
  await generateCodeDocs(target, options);
}

async function generateMarkdownDocs(
  target: string,
  options: { style?: string; interactive?: boolean; verbose?: boolean; type?: string }
): Promise<void> {
  const filePath = resolve(target);

  // Get all scan results
  let results = (await loadScanCache()) as ScanResult[] | null;
  if (!results) {
    logger.info('No cached scan results. Running scan first...\n');
    results = await runScan();
  }

  const codeResults = results.filter(isCodeResult);

  if (codeResults.length === 0) {
    logger.error('No code files found. Cannot generate markdown documentation.');
    return;
  }

  // Determine generation type
  const genType = options.type || await select({
    message: 'What type of markdown documentation would you like to generate?',
    choices: [
      { name: 'API Reference - List of all exported functions and classes', value: 'api' },
      { name: 'Architecture Overview - Project structure and organization', value: 'architecture' },
    ],
  });

  const config = await loadConfig();
  const generator = new MarkdownGenerator(config);
  const spinner = createSpinner(`Generating ${genType} documentation`);
  spinner.start();

  let content: string;
  if (genType === 'api') {
    content = generator.generateAPIReferenceDoc(codeResults);
  } else {
    content = generator.generateArchitectureDoc(codeResults);
  }

  spinner.succeed('Documentation generated!');

  // Show preview
  console.log(chalk.green('\n--- Generated Markdown ---'));
  console.log(content.split('\n').slice(0, 30).join('\n'));
  if (content.split('\n').length > 30) {
    console.log(chalk.dim('... (truncated, see full content after writing)'));
  }
  console.log(chalk.green('-------------------------\n'));

  // Confirm before writing
  const shouldWrite = await confirm({
    message: `Write this documentation to ${target}?`,
    default: true,
  });

  if (shouldWrite) {
    await writeFile(filePath, content, 'utf-8');
    logger.success(`Documentation written to ${target}!`);
  } else {
    logger.info('Generation cancelled.');
  }
}

async function generateCodeDocs(
  target: string,
  options: { style?: string; interactive?: boolean; verbose?: boolean }
): Promise<void> {
  // Parse target: file.ts or file.ts:functionName
  const [filePart, functionName] = target.split(':');
  const filePath = resolve(filePart);
  const style = options.style ?? 'jsdoc';

  // Scan the file
  const registry = ScannerRegistry.getInstance();
  const scanner = registry.getScanner(filePath);

  if (!scanner) {
    logger.error(`No scanner available for file: ${filePart}`);
    return;
  }

  const scanResult = await scanner.scanFile(filePath);

  if (!isCodeResult(scanResult)) {
    logger.error(`Cannot generate documentation for non-code files: ${filePart}`);
    return;
  }

  let functions = scanResult.functions.filter((f) => !f.hasDocumentation);
  if (functionName) {
    functions = scanResult.functions.filter((f) => f.name === functionName);
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
        metrics.recordDocGenerated();
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
