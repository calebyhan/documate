import { HealthCalculator } from '../../core/analyzers/health-calculator.js';
import { loadScanCache } from '../../utils/config.js';
import { runScan } from './scan.js';
import { renderHealthView } from '../ui/views.js';
import { createSpinner } from '../ui/components.js';
import { logger } from '../../utils/logger.js';
import type { ScanResult } from '../../types/index.js';

export async function healthCommand(options: { verbose?: boolean }): Promise<void> {
  let results = (await loadScanCache()) as ScanResult[] | null;

  if (!results) {
    logger.info('No cached scan results found. Running scan...\n');
    const spinner = createSpinner('Scanning codebase');
    spinner.start();
    results = await runScan();
    spinner.succeed('Scan complete!');
    console.log();
  }

  const calculator = new HealthCalculator();
  const health = calculator.calculateHealth(results);

  renderHealthView(health);
}
