import { relative } from 'node:path';
import chalk from 'chalk';
import Table from 'cli-table3';
import {
  renderHeader,
  renderHealthScore,
  renderProgressBar,
  renderPriorityBadge,
  renderDriftMeter,
} from './components.js';
import type { ScanResult, HealthReport, DebtIssue, DriftReport } from '../../types/index.js';
import { isCodeResult, isMarkdownResult } from '../../types/index.js';

export function renderScanResults(results: ScanResult[]): void {
  console.log(renderHeader('DocuMate', 'Scan Results'));

  // Separate code and markdown results
  const codeResults = results.filter(isCodeResult);
  const markdownResults = results.filter(isMarkdownResult);

  // Render code results
  if (codeResults.length > 0) {
    renderCodeScanResults(codeResults);
  }

  // Render markdown results
  if (markdownResults.length > 0) {
    renderMarkdownScanResults(markdownResults);
  }

  // Show helpful tips
  console.log(chalk.cyan('\n💡 Run "documate health" for a detailed health report'));
  console.log(chalk.cyan('💡 Run "documate fix -i" to interactively fix issues\n'));
}

function renderCodeScanResults(results: ScanResult[]): void {
  const codeResults = results.filter(isCodeResult);

  const totalFunctions = codeResults.reduce((sum, r) => sum + r.functions.length, 0);
  const totalClasses = codeResults.reduce((sum, r) => sum + r.classes.length, 0);
  const documented = codeResults.reduce(
    (sum, r) => sum + r.functions.filter((f) => f.hasDocumentation).length,
    0,
  );
  const totalMethods = codeResults.reduce(
    (sum, r) => sum + r.classes.reduce((s, c) => s + c.methods.length, 0),
    0,
  );
  const documentedMethods = codeResults.reduce(
    (sum, r) =>
      sum + r.classes.reduce((s, c) => s + c.methods.filter((m) => m.hasDocumentation).length, 0),
    0,
  );

  const totalAll = totalFunctions + totalMethods;
  const documentedAll = documented + documentedMethods;
  const coverage = totalAll > 0 ? Math.round((documentedAll / totalAll) * 100) : 100;

  // Group by language
  const languageCounts: Record<string, number> = {};
  for (const r of codeResults) {
    languageCounts[r.language] = (languageCounts[r.language] || 0) + 1;
  }

  console.log(chalk.bold('\n📝 Code Files'));

  const table = new Table({
    head: [chalk.cyan('Metric'), chalk.cyan('Value')],
    style: { head: [], border: ['gray'] },
  });

  table.push(
    ['Files scanned', codeResults.length.toString()],
    [
      'Languages',
      Object.entries(languageCounts)
        .map(([lang, count]) => `${lang} (${count})`)
        .join(', '),
    ],
    ['Functions found', totalFunctions.toString()],
    ['Classes found', totalClasses.toString()],
    ['Methods found', totalMethods.toString()],
    ['Documented', `${documentedAll}/${totalAll}`],
    ['Coverage', `${renderProgressBar(coverage)} ${coverage}%`],
  );

  console.log(table.toString());

  // Show undocumented functions
  const undocumented = codeResults.flatMap((r) =>
    r.functions
      .filter((f) => !f.hasDocumentation)
      .map((f) => ({ file: r.file, fn: f })),
  );

  if (undocumented.length > 0) {
    console.log(chalk.yellow(`\n⚠ ${undocumented.length} undocumented functions:\n`));
    const issueTable = new Table({
      head: [chalk.cyan('Function'), chalk.cyan('File'), chalk.cyan('Line'), chalk.cyan('Exported')],
      style: { head: [], border: ['gray'] },
    });

    for (const { file, fn } of undocumented.slice(0, 15)) {
      const relFile = relative(process.cwd(), file);
      issueTable.push([
        fn.name,
        relFile,
        fn.location.startLine.toString(),
        fn.isExported ? chalk.yellow('Yes') : chalk.gray('No'),
      ]);
    }

    console.log(issueTable.toString());

    if (undocumented.length > 15) {
      console.log(chalk.dim(`\n  ... and ${undocumented.length - 15} more\n`));
    }
  }
}

function renderMarkdownScanResults(results: ScanResult[]): void {
  const markdownResults = results.filter(isMarkdownResult);

  console.log(chalk.bold('\n📄 Markdown Documentation'));

  const totalSections = markdownResults.reduce((sum, r) => sum + r.sections.length, 0);
  const totalLinks = markdownResults.reduce((sum, r) => sum + r.links.length, 0);
  const internalLinks = markdownResults.reduce(
    (sum, r) => sum + r.links.filter((l) => l.isInternal).length,
    0,
  );
  const totalCodeBlocks = markdownResults.reduce((sum, r) => sum + r.codeBlocks.length, 0);
  const totalCodeRefs = markdownResults.reduce((sum, r) => sum + r.codeReferences.length, 0);

  const table = new Table({
    head: [chalk.cyan('Metric'), chalk.cyan('Value')],
    style: { head: [], border: ['gray'] },
  });

  table.push(
    ['Files scanned', markdownResults.length.toString()],
    ['Sections', totalSections.toString()],
    ['Links', `${totalLinks} (${internalLinks} internal)`],
    ['Code blocks', totalCodeBlocks.toString()],
    ['Code references', totalCodeRefs.toString()],
  );

  console.log(table.toString());

  // Show file breakdown
  if (markdownResults.length > 0) {
    console.log(chalk.bold('\n📋 File Breakdown:\n'));

    const fileTable = new Table({
      head: [
        chalk.cyan('File'),
        chalk.cyan('Sections'),
        chalk.cyan('Links'),
        chalk.cyan('Code Blocks'),
      ],
      style: { head: [], border: ['gray'] },
    });

    for (const r of markdownResults.slice(0, 10)) {
      const relFile = relative(process.cwd(), r.file);
      fileTable.push([
        relFile,
        r.sections.length.toString(),
        r.links.length.toString(),
        r.codeBlocks.length.toString(),
      ]);
    }

    console.log(fileTable.toString());

    if (markdownResults.length > 10) {
      console.log(chalk.dim(`\n  ... and ${markdownResults.length - 10} more files\n`));
    }
  }
}

export function renderHealthView(health: HealthReport): void {
  console.log(renderHeader('DocuMate', 'Documentation Health Check'));
  console.log(renderHealthScore(health.overallScore));

  const metrics = [
    { name: 'Coverage', score: health.coverage, icon: '📊' },
    { name: 'Freshness', score: health.freshness, icon: '🔄' },
    { name: 'Accuracy', score: health.accuracy, icon: '🎯' },
    { name: 'Completeness', score: health.completeness, icon: '✅' },
  ];

  console.log('\n' + chalk.bold('Health Breakdown:'));
  for (const metric of metrics) {
    const bar = renderProgressBar(metric.score);
    console.log(`  ${metric.icon} ${metric.name.padEnd(14)} ${bar}  ${metric.score}%`);
  }

  if (health.issues.length > 0) {
    renderIssueList(health.issues);
  }

  console.log(chalk.cyan('\n💡 Run "documate fix -i" to resolve issues'));
  console.log(chalk.cyan('💡 Run "documate drift" to check for documentation drift\n'));
}

export function renderIssueList(issues: DebtIssue[]): void {
  const grouped = {
    critical: issues.filter((i) => i.severity === 'critical'),
    high: issues.filter((i) => i.severity === 'high'),
    medium: issues.filter((i) => i.severity === 'medium'),
    low: issues.filter((i) => i.severity === 'low'),
  };

  for (const [level, items] of Object.entries(grouped)) {
    if (items.length === 0) continue;
    console.log(`\n${renderPriorityBadge(level as DebtIssue['severity'])} (${items.length})`);
    for (const issue of items.slice(0, 5)) {
      const relFile = relative(process.cwd(), issue.file);
      console.log(`  ${relFile}:${issue.functionName}()`);
      console.log(chalk.dim(`  └─ ${issue.reason}`));
      if (issue.suggestion) {
        console.log(chalk.dim(`     🤖 ${issue.suggestion}`));
      }
    }
    if (items.length > 5) {
      console.log(chalk.dim(`  ... and ${items.length - 5} more`));
    }
  }
}

export function renderDriftResults(reports: DriftReport[]): void {
  console.log(renderHeader('DocuMate', 'Drift Analysis'));

  if (reports.length === 0) {
    console.log(chalk.green('\n✓ No documentation drift detected!\n'));
    return;
  }

  console.log(chalk.yellow(`\n⚠ Found ${reports.length} functions with documentation drift:\n`));

  for (const report of reports) {
    const relFile = relative(process.cwd(), report.file);
    console.log(chalk.bold(`📁 ${relFile}:${report.functionName}()`));
    console.log(`   Drift Score: ${renderDriftMeter(report.driftScore)}`);

    for (const change of report.changes) {
      const icon = change.isBreaking ? '💥' : '🔄';
      console.log(`   ${icon} ${change.description}`);
      if (change.impact) {
        console.log(chalk.dim(`      Impact: ${change.impact}`));
      }
    }

    if (report.recommendation) {
      console.log(chalk.cyan(`   🤖 ${report.recommendation}`));
    }
    console.log();
  }
}
