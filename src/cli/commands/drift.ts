import { resolve } from 'node:path';
import { DriftAnalyzer } from '../../core/analyzers/drift-analyzer.js';
import { GitAnalyzer } from '../../integrations/git.js';
import { CopilotWrapper } from '../../copilot/wrapper.js';
import { loadScanCache } from '../../utils/config.js';
import { runScan } from './scan.js';
import { renderDriftResults } from '../ui/views.js';
import { createSpinner } from '../ui/components.js';
import { logger, setVerbose } from '../../utils/logger.js';
import type { ScanResult } from '../../types/index.js';

export async function driftCommand(options: { file?: string; verbose?: boolean; commits?: string; since?: string }): Promise<void> {
  if (options.verbose) {
    setVerbose(true);
  }

  const commitLimit = options.commits ? parseInt(options.commits, 10) : 10;
  if (isNaN(commitLimit) || commitLimit < 1) {
    logger.error('--commits must be a positive number');
    process.exit(1);
  }

  const git = new GitAnalyzer();

  if (!(await git.isGitRepo())) {
    logger.error('Not a git repository. Drift detection requires git history.');
    process.exit(1);
  }

  let results = (await loadScanCache()) as ScanResult[] | null;
  if (!results) {
    logger.info('No cached scan results. Running scan first...\n');
    results = await runScan();
  }

  if (options.file) {
    const filePath = resolve(options.file);
    results = results.filter((r) => r.file === filePath);
    if (results.length === 0) {
      logger.warn(`File not found in scan results: ${options.file}`);
      return;
    }
  }

  // Try to set up Copilot
  const copilot = new CopilotWrapper();
  const prereqs = await copilot.checkPrerequisites();
  let copilotInstance: CopilotWrapper | undefined;

  if (prereqs.ok) {
    copilotInstance = copilot;
    if (options.verbose) {
      logger.info('GitHub Copilot available for semantic analysis');
    }
  } else {
    logger.warn(`Copilot not available: ${prereqs.error}`);
    logger.info('Using heuristic drift detection (signature comparison only)\n');
  }

  const spinner = createSpinner('Analyzing documentation drift');
  spinner.start();

  const analyzer = new DriftAnalyzer(git, copilotInstance);
  const reports = await analyzer.analyzeDrift(results, commitLimit, options.since);

  spinner.succeed(`Drift analysis complete! Found ${reports.length} drift issues.`);
  console.log();

  renderDriftResults(reports);
}
