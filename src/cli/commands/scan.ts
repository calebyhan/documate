import chalk from 'chalk';
import { resolve } from 'node:path';
import { TypeScriptScanner } from '../../core/scanners/typescript-scanner.js';
import { findFiles } from '../../utils/file-system.js';
import { loadConfig, saveScanCache } from '../../utils/config.js';
import { createProgressBar } from '../ui/components.js';
import { renderScanResults } from '../ui/views.js';
import { logger } from '../../utils/logger.js';
import type { ScanResult } from '../../types/index.js';

export async function scanCommand(path: string, options: { verbose?: boolean; json?: boolean }): Promise<void> {
  const targetPath = resolve(path);
  const config = await loadConfig();

  logger.info(`Scanning ${chalk.bold(targetPath)}...\n`);

  const files = await findFiles(config.scan.include, config.scan.exclude, targetPath);

  if (files.length === 0) {
    logger.warn('No files found to scan.');
    return;
  }

  logger.success(`Found ${files.length} files\n`);

  const scanner = new TypeScriptScanner();
  const supportedFiles = files.filter((f) => scanner.supports(f));

  if (supportedFiles.length === 0) {
    logger.warn('No supported files found.');
    return;
  }

  const progress = createProgressBar('Parsing code');
  progress.start(supportedFiles.length, 0);

  const results: ScanResult[] = [];
  for (let i = 0; i < supportedFiles.length; i++) {
    try {
      const result = await scanner.scanFile(supportedFiles[i]);
      results.push(result);
    } catch (err) {
      if (options.verbose) {
        logger.debug(`Failed to parse ${supportedFiles[i]}: ${err}`);
      }
    }
    progress.update(i + 1);
  }

  progress.stop();
  console.log();

  // Save scan results to cache
  await saveScanCache(results);

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  renderScanResults(results);
}

export async function runScan(targetPath: string = process.cwd()): Promise<ScanResult[]> {
  const config = await loadConfig();
  const files = await findFiles(config.scan.include, config.scan.exclude, targetPath);
  const scanner = new TypeScriptScanner();
  const supportedFiles = files.filter((f) => scanner.supports(f));

  const results: ScanResult[] = [];
  for (const file of supportedFiles) {
    try {
      results.push(await scanner.scanFile(file));
    } catch {
      // Skip unparseable files
    }
  }

  await saveScanCache(results);
  return results;
}
