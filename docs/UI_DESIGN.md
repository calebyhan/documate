# DocuMate Terminal UI Design Specification

## Design Principles

1. **Show Copilot Working** - Make AI analysis visible and engaging
2. **Progressive Disclosure** - Start simple, reveal complexity as needed
3. **Actionable** - Always show clear next steps
4. **Educational** - Explain WHY, not just WHAT
5. **Fast Feedback** - Instant responses, async operations with spinners
6. **Beautiful** - Polish matters, especially for demos

## Tech Stack

```json
{
  "dependencies": {
    "chalk": "^5.3.0",
    "ora": "^8.0.1",
    "inquirer": "^9.2.12",
    "cli-table3": "^0.6.3",
    "boxen": "^7.1.1",
    "gradient-string": "^2.0.2",
    "cli-progress": "^3.12.0",
    "marked-terminal": "^7.0.0",
    "ansi-escapes": "^6.2.0",
    "terminal-link": "^3.0.0"
  }
}
```

## Color Palette

```typescript
// src/ui/colors.ts
import chalk from 'chalk';

export const colors = {
  // Status colors
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.cyan,
  
  // Semantic colors
  copilot: chalk.hex('#0066FF'),
  critical: chalk.red.bold,
  high: chalk.yellow,
  medium: chalk.blue,
  low: chalk.gray,
  
  // UI elements
  header: chalk.bold.cyan,
  subheader: chalk.gray,
  emphasis: chalk.bold,
  dim: chalk.dim,
  
  // Special
  gradient: require('gradient-string')(['#0066FF', '#00D4FF'])
};
```

## Component Library

### 1. Header Component

```typescript
// src/ui/components/header.ts
import boxen from 'boxen';
import gradient from 'gradient-string';

export function renderHeader(title: string, subtitle?: string): string {
  const gradientTitle = gradient.pastel.multiline(title);
  
  return boxen(
    subtitle 
      ? `${gradientTitle}\n${chalk.gray(subtitle)}`
      : gradientTitle,
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
      align: 'center'
    }
  );
}

// Usage:
console.log(renderHeader('DocuMate', 'AI-Powered Documentation Assistant'));
```

**Output:**
```
╭────────────────────────────────────────────────╮
│                                                │
│              DocuMate                          │
│     AI-Powered Documentation Assistant         │
│                                                │
╰────────────────────────────────────────────────╯
```

### 2. Progress Bar Component

```typescript
// src/ui/components/progress.ts
import cliProgress from 'cli-progress';

export function createProgressBar(title: string) {
  return new cliProgress.SingleBar({
    format: `${colors.info('🔍')} ${title} | ${colors.emphasis('{bar}')} | {percentage}% | {value}/{total}`,
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true
  });
}

// Usage:
const bar = createProgressBar('Scanning files');
bar.start(100, 0);
// ... update progress
bar.update(50);
bar.stop();
```

### 3. Spinner Component

```typescript
// src/ui/components/spinner.ts
import ora from 'ora';

export class CopilotSpinner {
  private spinner: ora.Ora;
  private steps: string[] = [];
  
  constructor(message: string) {
    this.spinner = ora({
      text: colors.copilot(`🤖 ${message}`),
      spinner: 'dots'
    });
  }
  
  start() {
    this.spinner.start();
    return this;
  }
  
  addStep(step: string) {
    this.steps.push(step);
    this.spinner.text = colors.copilot(`🤖 GitHub Copilot is working...\n`) +
      this.steps.map((s, i) => 
        i === this.steps.length - 1 
          ? colors.info(`  └─ ${s}`)
          : colors.dim(`  ✓ ${s}`)
      ).join('\n');
  }
  
  succeed(message: string) {
    this.spinner.succeed(colors.success(`✓ ${message}`));
  }
  
  fail(message: string) {
    this.spinner.fail(colors.error(`✗ ${message}`));
  }
}

// Usage:
const spinner = new CopilotSpinner('Analyzing codebase');
spinner.start();
spinner.addStep('Understanding code semantics');
spinner.addStep('Detecting patterns');
spinner.addStep('Generating insights');
spinner.succeed('Analysis complete!');
```

### 4. Table Component

```typescript
// src/ui/components/table.ts
import Table from 'cli-table3';

export function createTable(options: {
  head: string[];
  colWidths?: number[];
}) {
  return new Table({
    head: options.head.map(h => colors.header(h)),
    colWidths: options.colWidths,
    style: {
      head: [],
      border: ['gray']
    }
  });
}

// Usage:
const table = createTable({
  head: ['Issue', 'Priority', 'File'],
  colWidths: [40, 15, 45]
});

table.push(
  [colors.critical('Parameter drift'), colors.critical('Critical'), 'src/api/auth.ts'],
  [colors.high('Missing docs'), colors.high('High'), 'src/api/payments.ts']
);

console.log(table.toString());
```

### 5. Health Score Component

```typescript
// src/ui/components/health-score.ts
export function renderHealthScore(score: number): string {
  const emoji = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
  const color = score >= 80 ? colors.success : score >= 60 ? colors.warning : colors.error;
  
  const barLength = 20;
  const filled = Math.round((score / 100) * barLength);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  
  return boxen(
    `\n${color.bold(score.toString())} ${emoji}\n` +
    `${color('/100')}\n\n` +
    color(bar),
    {
      padding: 1,
      align: 'center',
      borderStyle: 'round',
      borderColor: score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red'
    }
  );
}
```

### 6. Issue List Component

```typescript
// src/ui/components/issue-list.ts
export function renderIssueList(issues: Issue[]): string {
  const grouped = groupByPriority(issues);
  
  let output = '';
  
  if (grouped.critical.length > 0) {
    output += colors.critical(`\n🔴 Critical Issues (${grouped.critical.length})\n`);
    grouped.critical.slice(0, 3).forEach((issue, i) => {
      output += `  ${i + 1}. ${issue.file}:${issue.function}() - ${issue.description}\n`;
      output += colors.dim(`     └─ 🤖 Copilot: ${issue.suggestion}\n`);
    });
    if (grouped.critical.length > 3) {
      output += colors.dim(`     ... and ${grouped.critical.length - 3} more\n`);
    }
  }
  
  if (grouped.high.length > 0) {
    output += colors.high(`\n🟡 High Priority (${grouped.high.length})\n`);
    // Similar rendering...
  }
  
  return output;
}
```

## Command-Specific UIs

### Command: `documate scan`

```typescript
// src/ui/views/scan.ts
export async function renderScanView(path: string) {
  console.clear();
  console.log(renderHeader('DocuMate', 'Scanning Codebase'));
  
  // Phase 1: File discovery
  const fileProgress = createProgressBar('Discovering files');
  fileProgress.start(100, 0);
  // ... scan files
  fileProgress.stop();
  
  console.log(colors.success('✓ Found 247 files\n'));
  
  // Phase 2: Parsing
  const parseProgress = createProgressBar('Parsing code');
  parseProgress.start(247, 0);
  // ... parse files
  parseProgress.stop();
  
  console.log(colors.success('✓ Parsed 247 functions\n'));
  
  // Phase 3: Copilot analysis
  const spinner = new CopilotSpinner('Analyzing with GitHub Copilot');
  spinner.start();
  spinner.addStep('Understanding code semantics');
  await sleep(500);
  spinner.addStep('Detecting complexity patterns');
  await sleep(500);
  spinner.addStep('Identifying documentation needs');
  await sleep(500);
  spinner.addStep('Prioritizing issues');
  spinner.succeed('Analysis complete!');
  
  console.log('\n');
  
  // Results
  renderScanResults(results);
}
```

**Output:**
```
╭────────────────────────────────────────────────╮
│                                                │
│              DocuMate                          │
│          Scanning Codebase                     │
│                                                │
╰────────────────────────────────────────────────╯

🔍 Discovering files | ████████████████████ | 100% | 247/247
✓ Found 247 files

🔍 Parsing code | ████████████████████ | 100% | 247/247
✓ Parsed 247 functions

🤖 GitHub Copilot is working...
  ✓ Understanding code semantics
  ✓ Detecting complexity patterns
  ✓ Identifying documentation needs
  └─ Prioritizing issues
✓ Analysis complete!

╭─ 📊 Scan Results ──────────────────────────────╮
│                                                │
│  Found 247 functions across 89 files           │
│  Analyzed 189 documentation blocks             │
│                                                │
│  🔴 8 critical issues                          │
│  🟡 23 high priority issues                    │
│  🟢 45 medium priority issues                  │
│                                                │
╰────────────────────────────────────────────────╯
```

### Command: `documate health`

```typescript
// src/ui/views/health.ts
export function renderHealthView(healthData: HealthData) {
  console.clear();
  console.log(renderHeader('DocuMate', 'Documentation Health Check'));
  
  // Overall score
  console.log(renderHealthScore(healthData.overallScore));
  
  // Breakdown
  console.log('\n╭─ 📊 Health Breakdown ──────────────────────────╮');
  console.log('│                                                │');
  
  const metrics = [
    { name: 'Coverage', score: healthData.coverage, icon: '📊' },
    { name: 'Freshness', score: healthData.freshness, icon: '🔄' },
    { name: 'Accuracy', score: healthData.accuracy, icon: '🎯' },
    { name: 'Completeness', score: healthData.completeness, icon: '✅' }
  ];
  
  metrics.forEach(metric => {
    const bar = renderProgressBar(metric.score);
    console.log(`│  ${metric.icon} ${metric.name.padEnd(12)} ${bar}  ${metric.score}%  │`);
  });
  
  console.log('│                                                │');
  console.log('╰────────────────────────────────────────────────╯\n');
  
  // Issues summary
  console.log(renderIssueList(healthData.issues));
  
  // Next steps
  console.log('\n💡 Next Steps:');
  console.log(colors.info('   Run "documate fix --interactive" to resolve issues'));
  console.log(colors.info('   Run "documate drift validate-examples" to fix broken examples\n'));
}
```

**Output:**
```
╭────────────────────────────────────────────────╮
│                                                │
│              DocuMate                          │
│      Documentation Health Check                │
│                                                │
╰────────────────────────────────────────────────╯

╭──────────────────────────╮
│                          │
│          72 🟡          │
│         /100             │
│                          │
│   ██████████████░░░░░░   │
│                          │
╰──────────────────────────╯

╭─ 📊 Health Breakdown ──────────────────────────╮
│                                                │
│  📊 Coverage      ████████████░░░░░░░░  67%   │
│  🔄 Freshness     ████████████░░░░░░░░  62%   │
│  🎯 Accuracy      ██████████████████░░  89%   │
│  ✅ Completeness  ██████████████░░░░░░  71%   │
│                                                │
╰────────────────────────────────────────────────╯

🔴 Critical Issues (8)
  1. src/api/auth.ts:login() - Parameter drift
     └─ 🤖 Copilot: Parameter 'rememberMe' added but not documented

  2. src/api/payments.ts:processPayment() - Missing documentation
     └─ 🤖 Copilot: Complex function with 5 error cases needs docs

  3. src/utils/parser.ts:parseConfig() - Return type changed
     └─ 🤖 Copilot: Docs show synchronous usage but now returns Promise

💡 Next Steps:
   Run "documate fix --interactive" to resolve issues
   Run "documate drift validate-examples" to fix broken examples
```

### Command: `documate fix --interactive`

```typescript
// src/ui/views/interactive-fix.ts
export async function renderInteractiveFix(issues: Issue[]) {
  console.clear();
  console.log(renderHeader('DocuMate', 'Interactive Fix Session'));
  console.log(colors.dim(`Found ${issues.length} issues. Let's tackle them in priority order.\n`));
  
  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    
    console.log('━'.repeat(50));
    console.log(colors.emphasis(`Issue ${i + 1} of ${issues.length}`));
    console.log(renderPriorityBadge(issue.priority));
    console.log('━'.repeat(50));
    console.log('\n');
    
    // File and function info
    console.log(colors.info(`📁 ${issue.file}`));
    console.log(colors.info(`🔍 Function: ${issue.function}()`));
    console.log(colors.warning(`⚠️  Problem: ${issue.description}\n`));
    
    // Code change visualization
    if (issue.codeDiff) {
      console.log('┌─ Code Change ──────────────────────────────────┐');
      issue.codeDiff.split('\n').forEach(line => {
        if (line.startsWith('+')) {
          console.log('│ ' + colors.success(line) + ' '.repeat(50 - line.length) + '│');
        } else if (line.startsWith('-')) {
          console.log('│ ' + colors.error(line) + ' '.repeat(50 - line.length) + '│');
        } else {
          console.log('│ ' + colors.dim(line) + ' '.repeat(50 - line.length) + '│');
        }
      });
      console.log('└────────────────────────────────────────────────┘\n');
    }
    
    // Current docs
    if (issue.currentDocs) {
      console.log('┌─ Current Docs ─────────────────────────────────┐');
      issue.currentDocs.split('\n').forEach(line => {
        console.log('│ ' + line + ' '.repeat(50 - line.length) + '│');
      });
      console.log('└────────────────────────────────────────────────┘\n');
    }
    
    // Copilot analysis
    console.log(colors.copilot('🤖 GitHub Copilot Analysis:'));
    console.log(colors.dim(`   ${issue.copilotAnalysis}\n`));
    
    // Suggested fix
    console.log('┌─ Suggested Fix ────────────────────────────────┐');
    issue.suggestedFix.split('\n').forEach(line => {
      console.log('│ ' + colors.success(line) + ' '.repeat(50 - line.length) + '│');
    });
    console.log('└────────────────────────────────────────────────┘\n');
    
    // User prompt
    const answer = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '[A] Apply this fix', value: 'apply' },
        { name: '[E] Edit the suggestion', value: 'edit' },
        { name: '[S] Skip this issue', value: 'skip' },
        { name: '[I] More info (show full context)', value: 'info' },
        { name: '[V] View Copilot reasoning', value: 'verbose' },
        { name: '[Q] Quit session', value: 'quit' }
      ]
    }]);
    
    // Handle action
    switch (answer.action) {
      case 'apply':
        const spinner = ora('Applying fix...').start();
        await applyFix(issue);
        spinner.succeed(colors.success('✓ Fix applied!\n'));
        break;
        
      case 'edit':
        const edited = await editSuggestion(issue.suggestedFix);
        await applyFix({ ...issue, suggestedFix: edited });
        console.log(colors.success('✓ Custom fix applied!\n'));
        break;
        
      case 'skip':
        console.log(colors.dim('⊘ Skipped\n'));
        break;
        
      case 'quit':
        console.log(colors.info('\n👋 Session saved. Run "documate fix --interactive" to continue.\n'));
        return;
    }
    
    // Progress indicator
    if (i < issues.length - 1) {
      console.log(colors.dim(`\nProgress: ${i + 1}/${issues.length} issues processed\n`));
    }
  }
  
  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log(colors.success.bold('🎉 All issues processed!\n'));
  console.log(colors.info('Run "documate health" to see updated scores\n'));
}
```

### Command: `documate drift analyze`

```typescript
// src/ui/views/drift-analysis.ts
export async function renderDriftAnalysis(file: string, analysis: DriftAnalysis) {
  console.clear();
  console.log(renderHeader('DocuMate', 'Drift Analysis'));
  
  console.log(colors.info(`📁 Analyzing: ${file}\n`));
  
  // Copilot working
  const spinner = new CopilotSpinner('Analyzing code changes');
  spinner.start();
  spinner.addStep('Comparing versions');
  spinner.addStep('Detecting semantic changes');
  spinner.addStep('Evaluating documentation impact');
  spinner.succeed('Drift analysis complete!');
  
  console.log('\n');
  
  // Results
  if (analysis.driftScore === 0) {
    console.log(boxen(
      colors.success.bold('✓ No drift detected!\n\n') +
      'Documentation is up-to-date with code.',
      { padding: 1, borderColor: 'green', borderStyle: 'round' }
    ));
    return;
  }
  
  // Drift score
  console.log('┌─ Drift Score ──────────────────────────────────┐');
  console.log(`│                                                │`);
  console.log(`│  ${renderDriftMeter(analysis.driftScore)}                │`);
  console.log(`│                                                │`);
  console.log('└────────────────────────────────────────────────┘\n');
  
  // Changes
  console.log(colors.emphasis('📝 Detected Changes:\n'));
  
  analysis.changes.forEach((change, i) => {
    const icon = change.isBreaking ? '💥' : '🔄';
    const color = change.severity === 'critical' ? colors.critical : 
                  change.severity === 'high' ? colors.high : colors.medium;
    
    console.log(color(`${icon} ${change.type.toUpperCase()}`));
    console.log(`   ${change.description}`);
    console.log(colors.dim(`   Impact: ${change.impact}`));
    if (change.isBreaking) {
      console.log(colors.error('   ⚠️  BREAKING CHANGE'));
    }
    console.log();
  });
  
  // Documentation impact
  console.log(colors.emphasis('📚 Documentation Impact:\n'));
  
  if (analysis.outdatedSections.length > 0) {
    console.log(colors.warning('   Sections needing updates:'));
    analysis.outdatedSections.forEach(section => {
      console.log(colors.dim(`   • ${section}`));
    });
    console.log();
  }
  
  if (analysis.missingInformation.length > 0) {
    console.log(colors.warning('   New information to add:'));
    analysis.missingInformation.forEach(info => {
      console.log(colors.dim(`   • ${info}`));
    });
    console.log();
  }
  
  // Copilot recommendation
  console.log(colors.copilot('🤖 Copilot Recommendation:\n'));
  console.log(colors.dim(`   ${analysis.recommendation}\n`));
  
  // Next steps
  console.log(colors.info('💡 Next Steps:'));
  console.log(colors.info(`   Run "documate fix --interactive" to update documentation`));
  console.log(colors.info(`   Run "documate drift history ${file}" to see change timeline\n`));
}
```

### Command: `documate chat`

```typescript
// src/ui/views/chat.ts
export async function renderChatMode() {
  console.clear();
  console.log(renderHeader('DocuMate Chat', 'Powered by GitHub Copilot'));
  
  console.log(colors.copilot('🤖 Hi! I\'m DocuMate, your AI documentation assistant.'));
  console.log(colors.dim('   Ask me anything about your documentation!\n'));
  console.log(colors.dim('   Type "exit" to quit, "help" for commands.\n'));
  
  const chat = new ConversationalMode();
  
  while (true) {
    const { message } = await inquirer.prompt([{
      type: 'input',
      name: 'message',
      message: colors.info('You:'),
      prefix: ''
    }]);
    
    if (message.toLowerCase() === 'exit') {
      console.log(colors.copilot('\n🤖 Goodbye! Happy documenting! 👋\n'));
      break;
    }
    
    if (message.toLowerCase() === 'help') {
      renderChatHelp();
      continue;
    }
    
    // Show Copilot thinking
    const spinner = ora({
      text: colors.copilot('🤖 Thinking...'),
      spinner: 'dots'
    }).start();
    
    const response = await chat.chat(message);
    
    spinner.stop();
    console.log(colors.copilot('\n🤖 DocuMate:'));
    console.log(colors.dim('   ' + response.replace(/\n/g, '\n   ')) + '\n');
  }
}
```

## Utility Functions

### Progress Bar Renderer

```typescript
export function renderProgressBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  
  const color = percentage >= 80 ? colors.success : 
                percentage >= 60 ? colors.warning : colors.error;
  
  return color(bar);
}
```

### Priority Badge

```typescript
export function renderPriorityBadge(priority: 'critical' | 'high' | 'medium' | 'low'): string {
  const badges = {
    critical: colors.critical('🔴 CRITICAL'),
    high: colors.high('🟡 HIGH'),
    medium: colors.medium('🔵 MEDIUM'),
    low: colors.low('⚪ LOW')
  };
  
  return badges[priority];
}
```

### Drift Meter

```typescript
export function renderDriftMeter(score: number): string {
  // 0-3: Low, 4-6: Medium, 7-8: High, 9-10: Critical
  const level = score <= 3 ? 'low' : score <= 6 ? 'medium' : score <= 8 ? 'high' : 'critical';
  
  const colors_map = {
    low: colors.success,
    medium: colors.info,
    high: colors.warning,
    critical: colors.critical
  };
  
  const labels = {
    low: '🟢 Low Drift',
    medium: '🔵 Medium Drift',
    high: '🟡 High Drift',
    critical: '🔴 Critical Drift'
  };
  
  return colors_map[level](`${score}/10 - ${labels[level]}`);
}
```

## Animation Effects

### Typewriter Effect

```typescript
export async function typewriterEffect(text: string, speed: number = 30) {
  for (const char of text) {
    process.stdout.write(char);
    await sleep(speed);
  }
  console.log();
}
```

### Loading Animation

```typescript
export async function showLoadingAnimation(duration: number = 2000) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  
  const interval = setInterval(() => {
    process.stdout.write(`\r${colors.copilot(frames[i++ % frames.length])} GitHub Copilot is thinking...`);
  }, 80);
  
  setTimeout(() => {
    clearInterval(interval);
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
  }, duration);
}
```

## Error Handling UI

```typescript
export function renderError(error: Error, context?: string) {
  console.log('\n' + boxen(
    colors.error.bold('❌ Error\n\n') +
    colors.error(error.message) +
    (context ? '\n\n' + colors.dim(context) : ''),
    {
      padding: 1,
      borderColor: 'red',
      borderStyle: 'round'
    }
  ) + '\n');
}

export function renderWarning(message: string) {
  console.log('\n' + boxen(
    colors.warning.bold('⚠️  Warning\n\n') +
    colors.warning(message),
    {
      padding: 1,
      borderColor: 'yellow',
      borderStyle: 'round'
    }
  ) + '\n');
}
```

## Responsive Layout

```typescript
export function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

export function wrapText(text: string, maxWidth?: number): string {
  const width = maxWidth || getTerminalWidth() - 4;
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + word).length > width) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  
  if (currentLine) {
    lines.push(currentLine.trim());
  }
  
  return lines.join('\n');
}
```

## Summary

This UI design provides:
- ✅ Clear visual hierarchy
- ✅ Engaging Copilot integration displays
- ✅ Interactive workflows
- ✅ Beautiful, professional appearance
- ✅ Responsive to terminal size
- ✅ Consistent component library
- ✅ Demo-ready polish

All components are designed to showcase GitHub Copilot CLI as the intelligent brain of DocuMate while maintaining excellent usability.
