import { resolve, relative } from 'node:path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { DriftAnalyzer } from '../../core/analyzers/drift-analyzer.js';
import { MarkdownDriftAnalyzer } from '../../core/analyzers/markdown-drift-analyzer.js';
import { GitAnalyzer } from '../../integrations/git.js';
import { CopilotWrapper } from '../../copilot/wrapper.js';
import { loadScanCache } from '../../utils/config.js';
import { runScan } from './scan.js';
import { renderDriftResults } from '../ui/views.js';
import { createSpinner } from '../ui/components.js';
import { logger, setVerbose } from '../../utils/logger.js';
import type { ScanResult, DriftReport, MarkdownDriftFileReport } from '../../types/index.js';
import { isCodeResult, isMarkdownResult } from '../../types/index.js';

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

  // Separate code and markdown results
  const codeResults = results.filter(isCodeResult);
  const markdownResults = results.filter(isMarkdownResult);

  if (codeResults.length === 0 && markdownResults.length === 0) {
    logger.warn('No files found in scan results.');
    return;
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

  // Analyze code drift
  let codeDriftReports: DriftReport[] = [];
  if (codeResults.length > 0) {
    const spinner = createSpinner('Analyzing code documentation drift');
    spinner.start();

    const analyzer = new DriftAnalyzer(git, copilotInstance);
    codeDriftReports = await analyzer.analyzeDrift(codeResults, commitLimit, options.since);

    spinner.succeed(`Code drift analysis complete! Found ${codeDriftReports.length} drift issues.`);
  }

  // Analyze markdown drift
  let markdownDriftReports: MarkdownDriftFileReport[] = [];
  if (markdownResults.length > 0) {
    const spinner = createSpinner('Analyzing markdown documentation drift');
    spinner.start();

    const mdAnalyzer = new MarkdownDriftAnalyzer(git);
    markdownDriftReports = await mdAnalyzer.analyzeDrift(markdownResults, codeResults);

    const totalIssues = markdownDriftReports.reduce(
      (sum, r) => sum + r.outdatedSections.length + r.staleReferences.length,
      0
    );
    spinner.succeed(`Markdown drift analysis complete! Found ${totalIssues} drift issues.`);
  }

  console.log();

  // Render results
  if (codeDriftReports.length > 0) {
    renderDriftResults(codeDriftReports);
  }

  if (markdownDriftReports.length > 0) {
    renderMarkdownDriftResults(markdownDriftReports);
  }

  if (codeDriftReports.length === 0 && markdownDriftReports.length === 0) {
    logger.success('No drift detected! Documentation is up to date.');
  }
}

function renderMarkdownDriftResults(reports: MarkdownDriftFileReport[]): void {
  console.log(chalk.bold('\n📄 Markdown Drift Report\n'));

  for (const report of reports) {
    const relFile = relative(process.cwd(), report.file);
    const totalIssues = report.outdatedSections.length + report.staleReferences.length;

    if (totalIssues === 0) continue;

    console.log(chalk.cyan(`\n📁 ${relFile}`));
    console.log(chalk.yellow(`Drift Score: ${report.driftScore}/100`));
    console.log(chalk.dim(`Last Modified: ${report.lastModified}\n`));

    if (report.outdatedSections.length > 0) {
      console.log(chalk.bold('  Outdated Sections:'));
      for (const section of report.outdatedSections) {
        console.log(chalk.red(`    ✗ Line ${section.lineNumber}: ${section.section}`));
        console.log(chalk.dim(`      ${section.reason}`));
      }
      console.log();
    }

    if (report.staleReferences.length > 0) {
      console.log(chalk.bold('  Stale References:'));
      for (const ref of report.staleReferences) {
        console.log(chalk.yellow(`    ⚠ ${ref.reference}`));
        console.log(chalk.dim(`      Markdown last modified: ${ref.lastModified}`));
        console.log(chalk.dim(`      Code last modified: ${ref.codeLastModified}`));
      }
      console.log();
    }

    if (report.suggestions.length > 0) {
      console.log(chalk.dim('  Suggestions:'));
      for (const suggestion of report.suggestions) {
        console.log(chalk.dim(`    • ${suggestion}`));
      }
      console.log();
    }
  }
}
