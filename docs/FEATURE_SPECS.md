# DocuMate Feature Specifications

## Core Features

This document provides detailed specifications for every feature in DocuMate.

---

## Feature 0: Initialization & Environment Check

### Overview
Ensure the environment is correctly set up for the CLI Wrapper architecture.

### CLI Interface
```bash
documate init
```

### Pre-flight Checks (CRITICAL)
Before any operation, DocuMate must verify:
1.  **GitHub CLI (`gh`)**: Is it in the PATH?
2.  **Copilot Extension**: Is `github/copilot` installed? (`gh extension list`)
3.  **Auth Status**: Is the user logged in? (`gh auth status`)

**Failure Behavior**:
If any check fails, DocuMate must exit with a clear error instruction.
Example: "❌ GitHub Copilot extension not found. Run `gh extension install github/copilot`"

### Configuration
`documate init` should also create the default config:
```json
// .documate.json
{
  "projectType": "typescript",
  "style": "jsdoc"
}
```

---

## Feature 1: Code Scanning

### Overview
Scan codebase to discover all functions, classes, and their documentation status.

### Supported Languages
- TypeScript (.ts, .tsx)
- JavaScript (.js, .jsx)
- Python (.py) - Phase 2
- Go (.go) - Phase 2

### What Gets Scanned

**Functions/Methods:**
- Name
- Parameters (name, type, optional/required)
- Return type
- Visibility (public/private/internal)
- Existing documentation (JSDoc, comments)
- Location (file, line numbers)
- Complexity metrics

**Classes:**
- Name
- Properties
- Methods
- Extends/implements
- Documentation

### Output Data Structure

```typescript
interface ScanResult {
  file: string;
  language: string;
  functions: FunctionInfo[];
  classes: ClassInfo[];
  exports: ExportInfo[];
}

interface FunctionInfo {
  name: string;
  type: 'function' | 'method' | 'arrow';
  params: ParameterInfo[];
  returnType: string;
  hasDocumentation: boolean;
  documentation?: string;
  complexity: ComplexityMetrics;
  location: {
    startLine: number;
    endLine: number;
    column: number;
  };
  visibility: 'public' | 'private' | 'protected' | 'internal';
  isExported: boolean;
  isAsync: boolean;
}

interface ParameterInfo {
  name: string;
  type: string;
  isOptional: boolean;
  defaultValue?: string;
  description?: string;
}

interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  nestingDepth: number;
}
```

### CLI Interface

```bash
# Scan current directory
documate scan

# Scan specific path
documate scan ./src

# Scan with verbose output
documate scan --verbose

# Output as JSON
documate scan --json > results.json

# Scan specific language only
documate scan --lang typescript
```

### Implementation Details

**TypeScript/JavaScript:**
- Use TypeScript Compiler API
- Parse JSDoc comments
- Extract type information
- Handle both .ts and .js files

**Complexity Calculation:**
- Cyclomatic: Count decision points (if, for, while, case)
- Cognitive: Weight nested structures higher
- Use established algorithms (McCabe, Sonar)

**Performance:**
- Use worker threads for parallel processing
- Cache parsed ASTs
- Process files in batches of 50

---

## Feature 2: Documentation Debt Analysis

### Overview
Identify which code needs documentation and prioritize the work.

### What Gets Analyzed

**Missing Documentation:**
- Functions without any docs
- Incomplete documentation (missing params/returns)
- Parameters without descriptions
- Complex functions without explanation

**Priority Factors:**
1. Visibility (public > internal > private)
2. Complexity (higher = more important)
3. Usage (call count across codebase)
4. Team impact (files touched by multiple devs)
5. Change frequency (recently modified)

### Copilot Integration

```typescript
// Copilot analyzes each undocumented function
const analysis = await copilot.analyzeFunction(code, context);

// Returns:
{
  purpose: "High-level description",
  complexity: {
    score: 8,
    reasoning: "Multiple nested conditionals, async operations, error handling"
  },
  documentationPriority: {
    score: 9,
    reasoning: "Public API used by 12 files, complex logic needs explanation"
  },
  suggestedTopics: [
    "Error handling",
    "Rate limiting",
    "Authentication flow"
  ]
}
```

### Priority Scoring Algorithm

```typescript
function calculatePriority(func: FunctionInfo, context: ProjectContext): number {
  let score = 0;
  
  // Visibility (0-30 points)
  if (func.isExported && func.visibility === 'public') score += 30;
  else if (func.isExported) score += 20;
  else if (func.visibility === 'public') score += 15;
  
  // Complexity (0-25 points)
  if (func.complexity.cyclomaticComplexity > 10) score += 25;
  else if (func.complexity.cyclomaticComplexity > 5) score += 15;
  else score += 5;
  
  // Usage (0-20 points)
  const callCount = context.callGraph[func.name]?.count || 0;
  score += Math.min(callCount * 2, 20);
  
  // Team impact (0-15 points)
  const contributors = context.git.getContributors(func.file);
  score += Math.min(contributors.length * 3, 15);
  
  // Change frequency (0-10 points)
  const recentChanges = context.git.getRecentChanges(func.file, 30);
  score += Math.min(recentChanges, 10);
  
  return score;
}
```

### Output Format

```typescript
interface DebtReport {
  totalFunctions: number;
  documentedFunctions: number;
  undocumentedFunctions: number;
  coverage: number; // percentage
  issues: DebtIssue[];
}

interface DebtIssue {
  file: string;
  function: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  priority: number; // 0-100
  reason: string; // Human-readable explanation
  copilotAnalysis: {
    purpose: string;
    complexity: number;
    suggestedTopics: string[];
  };
  estimatedEffort: number; // minutes
}
```

---

## Feature 3: Drift Detection

### Overview
Detect when code changes but documentation doesn't update.

### Detection Methods

**1. Signature Changes**
- Parameters added/removed/reordered
- Parameter types changed
- Return type changed
- Optional vs required changes

**2. Behavior Changes**
- New error conditions
- Changed side effects
- Different async/sync behavior
- Modified algorithms

**3. Semantic Changes** (Copilot-powered)
- Renamed parameters with different meaning
- Changed business logic
- Updated validation rules
- Modified access patterns

### Git Integration

```typescript
interface GitHistory {
  file: string;
  function: string;
  changes: GitChange[];
}

interface GitChange {
  commit: string;
  date: Date;
  author: string;
  message: string;
  diff: string;
  affectsCode: boolean;
  affectsDocs: boolean;
}

// Detect drift
const codeChanges = history.changes.filter(c => c.affectsCode);
const docChanges = history.changes.filter(c => c.affectsDocs);

const drift = codeChanges.length > docChanges.length;
```

### Copilot Semantic Analysis

```typescript
// Compare old vs new versions
const driftAnalysis = await copilot.detectDrift({
  oldCode: gitHistory[1].content,
  newCode: gitHistory[0].content,
  currentDocs: currentDocumentation,
  commitInfo: gitHistory[0].commit
});

// Returns:
{
  hasSemanticChanges: true,
  changes: [
    {
      type: "parameter_added",
      description: "Added 'timeout' parameter",
      impact: "Users can now specify custom timeout",
      severity: "medium",
      isBreaking: false
    },
    {
      type: "behavior_changed",
      description: "Now throws TimeoutError instead of generic Error",
      impact: "Error handling needs updating",
      severity: "high",
      isBreaking: true
    }
  ],
  documentationImpact: {
    isOutdated: true,
    outdatedSections: ["Parameters", "Exceptions"],
    missingInformation: ["Timeout behavior", "TimeoutError details"]
  },
  driftScore: 7, // 0-10
  recommendation: "Update parameter list and add TimeoutError to exceptions"
}
```

### Drift Scoring

```typescript
function calculateDriftScore(analysis: DriftAnalysis): number {
  let score = 0;
  
  // Count changes
  const changeCount = analysis.changes.length;
  score += Math.min(changeCount * 2, 4);
  
  // Breaking changes
  const breakingChanges = analysis.changes.filter(c => c.isBreaking).length;
  score += breakingChanges * 3;
  
  // Time since last doc update
  const daysSinceUpdate = daysBetween(lastCodeChange, lastDocUpdate);
  if (daysSinceUpdate > 30) score += 2;
  if (daysSinceUpdate > 90) score += 1;
  
  return Math.min(score, 10);
}
```

### Output Format

```typescript
interface DriftReport {
  file: string;
  function: string;
  driftScore: number; // 0-10
  lastCodeChange: Date;
  lastDocUpdate: Date;
  daysSinceDrift: number;
  changes: SemanticChange[];
  documentationImpact: DocumentationImpact;
  recommendation: string;
}
```

---

## Feature 4: Documentation Generation

### Overview
Generate high-quality documentation using GitHub Copilot CLI.

### Generation Modes

**1. Auto Mode**
- Analyzes code
- Generates complete documentation
- No user interaction
- Good for batch operations

**2. Interactive Mode**
- Copilot asks clarifying questions
- User provides context
- Multi-turn conversation
- Higher quality output

**3. Assisted Mode**
- Generates draft
- User reviews and edits
- Copilot suggests improvements
- Collaborative approach

### Interactive Generation Flow

```typescript
// Turn 1: Initial analysis
const questions = await copilot.chat(`
I need to document this function. What questions do you need answered?

Code:
${functionCode}

Project: ${projectContext}
`);

// Copilot asks:
// 1. What authentication methods are supported?
// 2. Are there rate limits?
// 3. What's the expected response time?
// 4. Any caching behavior?

// Turn 2: User provides answers
const answers = await gatherAnswersFromUser(questions);

// Turn 3: Generate with full context
const documentation = await copilot.chat(`
Now generate comprehensive documentation.

Code: ${functionCode}
Answers: ${answers}
Style: JSDoc
Include: description, params, returns, examples, notes
`);

// Turn 4: Review and refine
const refined = await copilot.chat(`
Review this documentation and suggest improvements:
${documentation}

Make it more:
- Concise
- Practical (better examples)
- Complete (cover edge cases)
`);
```

### Documentation Templates

**Function Template:**
```typescript
/**
 * [One-line summary]
 * 
 * [Detailed description explaining:
 *  - What the function does
 *  - When to use it
 *  - Important considerations]
 * 
 * @param {Type} paramName - Description
 * @param {Type} [optionalParam] - Description (optional)
 * @returns {Type} Description of return value
 * 
 * @throws {ErrorType} When condition occurs
 * 
 * @example
 * // Basic usage
 * const result = functionName(arg1, arg2);
 * 
 * @example
 * // With options
 * const result = functionName(arg1, arg2, { option: true });
 * 
 * @see {@link RelatedFunction} for related functionality
 * @since 1.0.0
 */
```

**Class Template:**
```typescript
/**
 * [One-line summary]
 * 
 * [Detailed description]
 * 
 * @class
 * @extends ParentClass
 * @implements Interface
 * 
 * @example
 * const instance = new ClassName(config);
 * instance.method();
 */
```

### Style Configuration

```json
// .documate.json
{
  "style": "jsdoc",
  "templates": {
    "function": "detailed",
    "class": "standard",
    "interface": "minimal"
  },
  "includeExamples": true,
  "exampleCount": 2,
  "includeTypeAnnotations": true,
  "includeThrows": true,
  "includeSee": true,
  "includeSince": false,
  "maxLineLength": 80,
  "customSections": [
    "Security",
    "Performance"
  ]
}
```

---

## Feature 5: Example Validation

### Overview
Validate that code examples in documentation actually work.

### Validation Process

**1. Extract Examples**
```typescript
// From JSDoc
/**
 * @example
 * const user = await login('email@example.com', 'password');
 * console.log(user.name);
 */

// Extracted:
{
  code: "const user = await login('email@example.com', 'password');\nconsole.log(user.name);",
  language: "typescript",
  location: { file: "auth.ts", line: 45 }
}
```

**2. Prepare Test Environment**
```typescript
// Create isolated test file
const testFile = `
import { login } from '../src/api/auth';

async function test() {
  ${example.code}
}

test().catch(console.error);
`;
```

**3. Execute Example**
```typescript
try {
  const result = await executeInSandbox(testFile);
  return { isValid: true, output: result };
} catch (error) {
  return { 
    isValid: false, 
    error: error.message,
    stack: error.stack
  };
}
```

**4. Analyze Failure** (Copilot)
```typescript
if (!result.isValid) {
  const fix = await copilot.fixExample({
    example: example.code,
    currentAPI: currentFunctionCode,
    error: result.error
  });
  
  return {
    ...result,
    suggestedFix: fix.correctedCode,
    explanation: fix.explanation,
    migrationNote: fix.migrationNote
  };
}
```

### Output Format

```typescript
interface ValidationResult {
  file: string;
  function: string;
  examples: ExampleValidation[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

interface ExampleValidation {
  code: string;
  lineNumber: number;
  isValid: boolean;
  output?: string;
  error?: {
    message: string;
    stack: string;
  };
  suggestedFix?: string;
  explanation?: string;
}
```

---

## Feature 6: Health Reporting

### Overview
Comprehensive documentation health metrics and trends.

### Health Metrics

**1. Coverage** (0-100%)
```typescript
coverage = (documentedFunctions / totalFunctions) * 100
```

**2. Freshness** (0-100%)
```typescript
// Percentage of docs that are up-to-date
const outdatedDocs = docsWithDrift.length;
freshness = ((totalDocs - outdatedDocs) / totalDocs) * 100
```

**3. Accuracy** (0-100%)
```typescript
// Percentage of examples that work
accuracy = (workingExamples / totalExamples) * 100
```

**4. Completeness** (0-100%)
```typescript
// Average completeness of documentation
// Checks: has description, all params documented, return documented, examples present
completeness = average(documentationCompleteness scores)
```

**5. Overall Score**
```typescript
overall = (
  coverage * 0.30 +
  freshness * 0.30 +
  accuracy * 0.20 +
  completeness * 0.20
)
```

### Trend Analysis

```typescript
interface HealthTrend {
  current: HealthScore;
  lastWeek: HealthScore;
  lastMonth: HealthScore;
  change7d: number; // percentage change
  change30d: number;
  direction: 'improving' | 'declining' | 'stable';
}
```

### Visual Reports

**Terminal:**
- ASCII graphs
- Progress bars
- Color-coded scores
- Emoji indicators

**HTML Export:**
- Interactive charts (Chart.js)
- Sortable tables
- Drill-down capabilities
- Shareable reports

**JSON Export:**
- Machine-readable
- For CI/CD integration
- For custom dashboards

---

## Feature 7: Interactive Fix Workflow

### Overview
Guided session to resolve documentation issues one by one.

### Session Flow

```
1. Load Issues
   └─> Prioritize by severity

2. For Each Issue:
   ├─> Show context (code, docs, changes)
   ├─> Display Copilot analysis
   ├─> Show suggested fix
   ├─> User chooses action:
   │   ├─> Apply
   │   ├─> Edit
   │   ├─> Skip
   │   ├─> More info
   │   └─> Quit
   └─> Save progress

3. Summary
   └─> Show what was fixed
```

### User Actions

**Apply Fix**
- Directly applies Copilot's suggestion
- Shows spinner while writing
- Confirms success

**Edit Fix**
- Opens editor with suggestion
- User modifies
- Applies edited version

**Skip Issue**
- Marks as skipped
- Can return later
- Continues to next

**More Info**
- Shows full function code
- Shows git history
- Shows Copilot reasoning
- Returns to action menu

**Quit Session**
- Saves progress
- Can resume later
- Shows summary of work done

### Progress Tracking

```typescript
interface FixSession {
  id: string;
  startTime: Date;
  totalIssues: number;
  processed: number;
  applied: number;
  skipped: number;
  edited: number;
  remainingIssues: Issue[];
}

// Save/restore session
await saveSession(session);
const resumed = await loadSession(sessionId);
```

---

## Feature 8: Conversational Mode

### Overview
Natural language interface for asking questions about documentation.

### Capabilities

**Questions About Health:**
- "What's my documentation coverage?"
- "Why is the health score low?"
- "Which files need the most work?"

**Questions About Specific Code:**
- "Why is login() high priority?"
- "What changed in processPayment()?"
- "Are there any breaking changes?"

**Best Practices:**
- "How should I document error handling?"
- "What makes good API documentation?"
- "Should I include examples for internal functions?"

**Explanations:**
- "Explain what drift means"
- "How is priority calculated?"
- "Why did this example break?"

### Context Awareness

```typescript
class ConversationalMode {
  private context = {
    projectData: {},      // Current health, issues
    recentActions: [],    // What user just did
    conversationHistory: [] // Previous Q&A
  };
  
  async chat(userMessage: string) {
    // Enrich message with context
    const enriched = `
Project: ${this.context.projectData.name}
Health Score: ${this.context.projectData.healthScore}
Recent Actions: ${this.context.recentActions.slice(-3)}
Issue Count: ${this.context.projectData.issueCount}

Previous conversation:
${this.context.conversationHistory.slice(-5)}

User: ${userMessage}

Respond helpfully, reference the project data, and be educational.
`;
    
    return await copilot.chat(enriched);
  }
}
```

### Example Conversation

```
You: Why is my health score only 62?

🤖 DocuMate: Your health score of 62/100 breaks down like this:

• Coverage (67%): You have 93 undocumented functions out of 282 total
• Freshness (62%): 23 docs are outdated due to code changes
• Accuracy (89%): Good! Most examples work
• Completeness (71%): Some docs are missing parameter descriptions

The biggest impact would be addressing the 8 critical drift issues, 
which would boost your freshness score significantly.

Want me to show you the critical issues? Just ask "show critical issues"

---

You: show critical issues

🤖 DocuMate: Here are your 8 critical drift issues:

1. src/api/auth.ts:login()
   - Parameter 'rememberMe' added but not documented
   - Last updated: 47 days ago
   
2. src/api/payments.ts:processPayment()
   - Return type changed from Object to Promise<PaymentResult>
   - Examples still show synchronous usage
   
... [continues]

You can run "documate fix --interactive" to resolve these.
```

---

## Feature 9: CI/CD Integration

### Overview
Run DocuMate in continuous integration to enforce documentation quality.

### Check Modes

**Strict Mode**
- Fails if any critical issues
- Fails if coverage decreases
- Fails if drift score too high

**Warning Mode**
- Warns but doesn't fail
- Generates report
- Posts PR comment

**Report Only**
- Generates metrics
- No pass/fail
- For tracking trends

### GitHub Actions Example

```yaml
name: Documentation Check

on:
  pull_request:
    branches: [main]

jobs:
  docs-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0 # Need history for drift detection
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install DocuMate
        run: npm install -g documate
      
      - name: Check Documentation
        run: |
          documate check \
            --strict \
            --fail-on-decrease \
            --max-drift-score 5 \
            --min-coverage 70 \
            --output github
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### PR Comments

```markdown
## 📚 Documentation Check

### Health Score: 68/100 🟡 (-4 from main)

| Metric | Score | Change |
|--------|-------|--------|
| Coverage | 65% | -2% ⚠️ |
| Freshness | 72% | +1% ✅ |
| Accuracy | 89% | → |
| Completeness | 68% | -1% ⚠️ |

### Issues Found

🔴 2 Critical Issues:
- `src/api/auth.ts:login()` - Parameter drift
- `src/utils/parser.ts:parseConfig()` - Return type changed

🟡 5 High Priority Issues

### Recommendation

Coverage decreased by 2%. Please document the new functions before merging.

Run `documate fix --interactive` locally to resolve issues.

<details>
<summary>View full report</summary>

[Detailed JSON/HTML report]

</details>
```

---

## Feature 10: Configuration & Customization

### Configuration File

```json
// .documate.json
{
  "version": "1.0",
  
  "scan": {
    "include": ["src/**/*.ts", "lib/**/*.ts"],
    "exclude": ["**/*.test.ts", "**/*.spec.ts"],
    "languages": ["typescript", "javascript"]
  },
  
  "documentation": {
    "style": "jsdoc",
    "requireExamples": true,
    "minExampleCount": 1,
    "maxExampleCount": 3,
    "includePrivate": false
  },
  
  "priorities": {
    "visibilityWeight": 0.3,
    "complexityWeight": 0.25,
    "usageWeight": 0.2,
    "teamImpactWeight": 0.15,
    "changeFrequencyWeight": 0.1
  },
  
  "drift": {
    "checkExamples": true,
    "maxDriftDays": 30,
    "maxDriftScore": 7
  },
  
  "ci": {
    "mode": "strict",
    "failOnCoverageDecrease": true,
    "minCoverage": 70,
    "maxCriticalIssues": 0
  },
  
  "output": {
    "format": "table",
    "colors": true,
    "emoji": true
  }
}
```

### Custom Templates

```typescript
// .documate/templates/function.mustache
/**
 * {{summary}}
 * 
 * {{description}}
 * 
 {{#params}}
 * @param { {{type}} } {{name}} - {{description}}
 {{/params}}
 * @returns { {{returnType}} } {{returnDescription}}
 * 
 {{#examples}}
 * @example
 * {{code}}
 {{/examples}}
 */
```

---

## Summary

These 10 core features work together to provide comprehensive documentation management:

1. **Scan** - Discover what exists
2. **Debt Analysis** - Find what's missing
3. **Drift Detection** - Catch what's outdated
4. **Generation** - Create new docs
5. **Validation** - Ensure examples work
6. **Health** - Track overall quality
7. **Interactive Fix** - Resolve issues
8. **Conversational** - Natural interface
9. **CI/CD** - Enforce quality
10. **Configuration** - Customize behavior

All powered by **GitHub Copilot CLI** for intelligent, context-aware documentation assistance.
