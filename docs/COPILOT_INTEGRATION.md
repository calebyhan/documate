# GitHub Copilot CLI Integration Guide

## Overview

This document details exactly how GitHub Copilot CLI is integrated into DocuMate. Every integration point includes code examples, prompt patterns, and best practices.

## Core Principle

**Copilot CLI is the "brain" of DocuMate**. Without Copilot, DocuMate would be a basic pattern matcher. With Copilot, it becomes truly intelligent, understanding semantic meaning and providing actionable insights.

## Setup & Configuration

### Prerequisites

1. **GitHub CLI (`gh`)**: Must be installed and authenticated.
2. **Copilot Extension**: Must be installed via `gh extension install github/copilot`.
3. **Active Subscription**: User must have an active Copilot subscription.

### Architecture: The CLI Wrapper

Since there is no public Node.js SDK for Copilot, we act as a **Wrapper** around the `gh copilot` CLI command.

#### Wrapper Implementation

```typescript
// src/copilot/wrapper.ts
import { spawn } from 'child_process';

export class CopilotWrapper {
  async runCommand(prompt: string, context?: string): Promise<string> {
    // We construct a specific prompt to force JSON output if possible,
    // though the CLI is conversational by default.
    const fullPrompt = `${prompt}\n\nContext: ${context || ''}`;
    
    return new Promise((resolve, reject) => {
      const child = spawn('gh', ['copilot', 'explain', fullPrompt], {
        env: { ...process.env, GH_FORCE_TTY: '100%' } // Force color/formatting if needed
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => output += data.toString());
      child.stderr.on('data', (data) => error += data.toString());

      child.on('close', (code) => {
        if (code !== 0) return reject(new Error(error || 'Copilot CLI failed'));
        
        // CLEANUP: The CLI returns conversational text ("Here is the explanation...").
        // We must extract the JSON payload if we requested it.
        resolve(this.extractJson(output));
      });
    });
  }

  private extractJson(text: string): any {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);
    
    // Fallback: try to find raw JSON start/end
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(text.substring(start, end + 1));
    }
    
    return { raw: text };
  }
}
```

## Integration Points

### 1. Code Analysis & Understanding

**Use Case**: Analyze a function to understand its purpose, complexity, and documentation needs.

```typescript
// src/copilot/analyzers/code-analyzer.ts
export async function analyzeFunction(
  code: string, 
  functionName: string,
  fileContext: string
): Promise<FunctionAnalysis> {
  const copilot = new CopilotClient();
  
  const prompt = `Analyze this ${functionName} function and provide detailed insights:

\`\`\`typescript
${code}
\`\`\`

File context: ${fileContext}

Please analyze and respond in JSON format with:
{
  "purpose": "What does this function do in plain English?",
  "complexity": {
    "score": 1-10,
    "reasoning": "Why this complexity score?"
  },
  "parameters": [
    {
      "name": "param name",
      "purpose": "what is it for?",
      "type": "inferred type",
      "isRequired": boolean
    }
  ],
  "returnValue": {
    "type": "return type",
    "description": "what does it return?"
  },
  "errorConditions": ["list", "of", "possible", "errors"],
  "sideEffects": ["any", "side", "effects"],
  "visibility": "public|internal|private",
  "documentationPriority": {
    "score": 1-10,
    "reasoning": "why this priority?"
  }
}`;

  const response = await copilot.sendMessage(prompt);
  const analysis = JSON.parse(response.content[0].text);
  
  return analysis;
}
```

**Why Copilot is Essential:**
- Understands semantic meaning beyond syntax
- Identifies complexity through code understanding
- Recognizes patterns and anti-patterns
- Provides human-readable explanations

### 2. Drift Detection

**Use Case**: Compare old and new versions of code to detect meaningful changes.

```typescript
// src/copilot/analyzers/drift-detector.ts
export async function detectDrift(
  oldCode: string,
  newCode: string,
  existingDocs: string,
  commitInfo?: GitCommit
): Promise<DriftAnalysis> {
  const copilot = new CopilotClient();
  
  const prompt = `Compare these code versions and identify SEMANTIC changes that affect documentation:

OLD VERSION:
\`\`\`typescript
${oldCode}
\`\`\`

NEW VERSION:
\`\`\`typescript
${newCode}
\`\`\`

CURRENT DOCUMENTATION:
${existingDocs}

${commitInfo ? `COMMIT INFO: ${commitInfo.message} (${commitInfo.date})` : ''}

IMPORTANT: Distinguish between cosmetic changes (formatting, variable renames) and semantic changes (behavior, API, logic).

Respond in JSON:
{
  "hasSemanticChanges": boolean,
  "changes": [
    {
      "type": "parameter_added|parameter_removed|return_type_changed|behavior_changed|breaking_change",
      "description": "what changed",
      "impact": "how does this affect users?",
      "severity": "critical|high|medium|low",
      "isBreaking": boolean
    }
  ],
  "documentationImpact": {
    "isOutdated": boolean,
    "outdatedSections": ["which", "parts", "need", "updating"],
    "missingInformation": ["what", "new", "info", "should", "be", "added"]
  },
  "driftScore": 1-10,
  "recommendation": "specific action to take"
}`;

  const response = await copilot.sendMessage(prompt);
  return JSON.parse(response.content[0].text);
}
```

**Why Copilot is Essential:**
- Distinguishes semantic vs cosmetic changes
- Understands breaking changes that aren't obvious
- Recognizes when docs become incorrect
- Provides context-aware recommendations

### 3. Interactive Documentation Generation

**Use Case**: Multi-turn conversation with Copilot to generate high-quality docs.

```typescript
// src/copilot/generators/doc-generator.ts
export async function generateDocumentation(
  code: string,
  context: ProjectContext,
  interactive: boolean = true
): Promise<string> {
  const copilot = new CopilotClient();
  
  // Turn 1: Initial analysis and question generation
  const analysisPrompt = `I need to document this function. Please analyze it and tell me what questions you need answered to write excellent documentation.

\`\`\`typescript
${code}
\`\`\`

Project context:
- Type: ${context.projectType}
- Style: ${context.docStyle}
- Target audience: ${context.audience}

What do you need to know to write comprehensive, helpful documentation?`;

  const questions = await copilot.sendMessage(analysisPrompt);
  
  if (interactive) {
    // Turn 2: Get answers from user or infer from code
    const answers = await gatherAnswersFromUser(questions);
    
    // Turn 3: Generate with context
    const generationPrompt = `Now generate documentation based on our discussion.

Code:
\`\`\`typescript
${code}
\`\`\`

Answers to your questions:
${JSON.stringify(answers)}

Generate in ${context.docStyle} format. Include:
- Clear description
- All parameters with types and descriptions
- Return value
- Exceptions/errors
- At least 2 practical examples
- Any important notes or warnings`;

    const docs = await copilot.sendConversation([
      { role: 'user', content: analysisPrompt },
      { role: 'assistant', content: questions.content[0].text },
      { role: 'user', content: generationPrompt }
    ]);
    
    return docs.content[0].text;
  } else {
    // Auto-generate mode
    const autoPrompt = `Generate documentation for this function. Infer what you can from the code:

\`\`\`typescript
${code}
\`\`\`

Style: ${context.docStyle}
Format: Include description, params, returns, examples`;

    const docs = await copilot.sendMessage(autoPrompt);
    return docs.content[0].text;
  }
}
```

**Why Copilot is Essential:**
- Asks intelligent clarifying questions
- Generates human-quality documentation
- Maintains style consistency
- Creates practical, working examples

### 4. Example Validation & Fixing

**Use Case**: Validate code examples in documentation and fix broken ones.

```typescript
// src/copilot/validators/example-validator.ts
export async function validateAndFixExample(
  example: string,
  currentCode: string,
  error: Error | null
): Promise<ExampleFix> {
  const copilot = new CopilotClient();
  
  if (!error) {
    return { isValid: true, fixedExample: example };
  }
  
  const prompt = `This documentation example is broken. Fix it for the current API:

EXAMPLE FROM DOCS:
\`\`\`typescript
${example}
\`\`\`

CURRENT FUNCTION:
\`\`\`typescript
${currentCode}
\`\`\`

ERROR WHEN RUNNING EXAMPLE:
${error.message}
${error.stack}

Please:
1. Explain what changed in the API
2. Provide the corrected example
3. Explain the migration if it's a breaking change

Respond in JSON:
{
  "explanation": "what changed and why the example broke",
  "fixedExample": "corrected code",
  "isBreakingChange": boolean,
  "migrationNotes": "how to update existing code"
}`;

  const response = await copilot.sendMessage(prompt);
  return JSON.parse(response.content[0].text);
}
```

**Why Copilot is Essential:**
- Understands why examples break
- Fixes them correctly for new APIs
- Explains migration paths
- Maintains example quality and style

### 5. Breaking Change Detection

**Use Case**: Identify breaking changes and generate migration guides.

```typescript
// src/copilot/analyzers/breaking-change-detector.ts
export async function detectBreakingChanges(
  oldVersion: string,
  newVersion: string,
  versionNumber?: string
): Promise<BreakingChangeReport> {
  const copilot = new CopilotClient();
  
  const prompt = `Analyze these versions for breaking changes:

OLD API:
\`\`\`typescript
${oldVersion}
\`\`\`

NEW API:
\`\`\`typescript
${newVersion}
\`\`\`

${versionNumber ? `Version: ${versionNumber}` : ''}

Identify all breaking changes and generate a migration guide.

Respond in JSON:
{
  "breakingChanges": [
    {
      "type": "removed_function|changed_signature|changed_behavior|removed_parameter",
      "description": "what broke",
      "severity": "critical|high|medium",
      "oldUsage": "code showing old way",
      "newUsage": "code showing new way",
      "migrationSteps": ["step", "by", "step"]
    }
  ],
  "migrationGuide": "Full markdown migration guide with examples"
}`;

  const response = await copilot.sendMessage(prompt);
  return JSON.parse(response.content[0].text);
}
```

### 6. Smart Prioritization

**Use Case**: Prioritize documentation work based on multiple factors.

```typescript
// src/copilot/analyzers/prioritizer.ts
export async function prioritizeDocumentation(
  issues: DocumentationIssue[],
  projectContext: ProjectContext
): Promise<PrioritizedIssue[]> {
  const copilot = new CopilotClient();
  
  const prompt = `Help prioritize these documentation issues:

PROJECT CONTEXT:
- Name: ${projectContext.name}
- Type: ${projectContext.type}
- Team size: ${projectContext.teamSize}
- Deployment frequency: ${projectContext.deploymentFrequency}
- Public API: ${projectContext.hasPublicAPI}

ISSUES TO PRIORITIZE:
${JSON.stringify(issues, null, 2)}

For each issue, assign priority (Critical/High/Medium/Low) considering:
- User impact (public API > internal > private)
- Complexity (complex code needs better docs)
- Change frequency (recently modified code)
- Team collaboration (code touched by many developers)
- Security implications
- Business criticality

Respond in JSON:
{
  "prioritizedIssues": [
    {
      "issueId": "id",
      "priority": "Critical|High|Medium|Low",
      "score": 1-100,
      "reasoning": "why this priority?",
      "estimatedEffort": "time to fix",
      "recommendedAction": "what to do next"
    }
  ],
  "summary": "overall recommendation"
}`;

  const response = await copilot.sendMessage(prompt);
  const result = JSON.parse(response.content[0].text);
  
  return result.prioritizedIssues;
}
```

### 7. Conversational Interface

**Use Case**: Natural language Q&A about documentation.

```typescript
// src/copilot/chat/conversational.ts
export class ConversationalMode {
  private copilot: CopilotClient;
  private context: ConversationContext;
  
  constructor() {
    this.copilot = new CopilotClient();
    this.context = {
      projectData: {},
      conversationHistory: []
    };
  }
  
  async chat(userMessage: string): Promise<string> {
    const systemPrompt = `You are DocuMate, an AI documentation assistant powered by GitHub Copilot.

Your role:
- Help developers understand documentation health
- Explain why certain issues are prioritized
- Suggest improvements
- Answer questions about best practices

Project context:
${JSON.stringify(this.context.projectData)}

Be conversational, helpful, and educational. Use examples when helpful.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.context.conversationHistory,
      { role: 'user', content: userMessage }
    ];
    
    const response = await this.copilot.sendConversation(messages);
    const assistantMessage = response.content[0].text;
    
    // Update conversation history
    this.context.conversationHistory.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantMessage }
    );
    
    return assistantMessage;
  }
  
  setProjectContext(data: any) {
    this.context.projectData = data;
  }
}
```

## Prompt Engineering Best Practices

### 1. Be Specific About Format
```typescript
// ✅ GOOD: Specify exact JSON structure
const prompt = `Respond in JSON:
{
  "field1": "description",
  "field2": number
}`;

// ❌ BAD: Vague request
const prompt = `Tell me about this code`;
```

### 2. Provide Context
```typescript
// ✅ GOOD: Include relevant context
const prompt = `Analyze this function from a payment processing system:
${code}

Project: E-commerce platform
Team size: 15 developers
...`;

// ❌ BAD: No context
const prompt = `Analyze: ${code}`;
```

### 3. Use Multi-Turn Conversations for Complex Tasks
```typescript
// ✅ GOOD: Build understanding over multiple turns
const turn1 = await copilot.chat({ messages: [{ role: 'user', content: 'Analyze this...' }] });
const turn2 = await copilot.chat({ 
  messages: [
    { role: 'user', content: 'Analyze this...' },
    { role: 'assistant', content: turn1.content[0].text },
    { role: 'user', content: 'Now generate docs based on that analysis...' }
  ]
});
```

### 4. Request Reasoning
```typescript
// ✅ GOOD: Ask for explanations
const prompt = `Rate the priority 1-10 and explain your reasoning`;

// ❌ BAD: Just ask for score
const prompt = `Rate the priority 1-10`;
```

## Error Handling

```typescript
export async function safeCopilotCall<T>(
  operation: () => Promise<T>,
  fallback?: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error('Copilot API error:', error);
    
    if (error.message.includes('rate limit')) {
      throw new Error('Rate limited. Please try again in a moment.');
    }
    
    if (error.message.includes('authentication')) {
      throw new Error('Copilot authentication failed. Run `gh auth login`');
    }
    
    if (fallback !== undefined) {
      console.warn('Using fallback value');
      return fallback;
    }
    
    throw error;
  }
}
```

## UI Integration - Showing Copilot at Work

```typescript
// src/ui/copilot-ui.ts
import ora from 'ora';
import chalk from 'chalk';

export async function withCopilotSpinner<T>(
  operation: () => Promise<T>,
  messages: {
    start: string;
    success: string;
    fail?: string;
  }
): Promise<T> {
  const spinner = ora({
    text: chalk.cyan(`🤖 ${messages.start}`),
    spinner: 'dots'
  }).start();
  
  try {
    const result = await operation();
    spinner.succeed(chalk.green(`✓ ${messages.success}`));
    return result;
  } catch (error) {
    spinner.fail(chalk.red(`✗ ${messages.fail || 'Copilot analysis failed'}`));
    throw error;
  }
}

// Usage:
const analysis = await withCopilotSpinner(
  () => analyzeFunction(code, 'login', context),
  {
    start: 'GitHub Copilot is analyzing login()...',
    success: 'Analysis complete - found 3 issues'
  }
);
```

## Performance Considerations

### 1. Batch Requests When Possible
```typescript
// Instead of N API calls, batch similar analyses
const analyses = await Promise.all(
  functions.map(fn => analyzeFunction(fn.code, fn.name, context))
);
```

### 2. Cache Results
```typescript
// Cache Copilot responses for identical inputs
const cache = new Map<string, any>();

export async function cachedCopilotCall(
  key: string,
  operation: () => Promise<any>
): Promise<any> {
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const result = await operation();
  cache.set(key, result);
  return result;
}
```

### 3. Progressive Enhancement
```typescript
// Start with fast operations, then enhance with Copilot
const quickScan = performSyntaxScan(code); // Fast, no API
const semanticAnalysis = await analyzeDriftWithCopilot(code); // Slower, AI-powered

return {
  ...quickScan,
  ...semanticAnalysis // Enhances quick scan with AI insights
};
```

## Testing Copilot Integration

```typescript
// tests/copilot/mock-copilot.ts
export class MockCopilotClient extends CopilotClient {
  async sendMessage(message: string) {
    // Return mock responses for testing
    if (message.includes('analyze')) {
      return {
        content: [{
          text: JSON.stringify({
            purpose: "Mock analysis",
            complexity: { score: 5, reasoning: "Test" }
          })
        }]
      };
    }
    
    return { content: [{ text: "Mock response" }] };
  }
}

// Use in tests
const copilot = new MockCopilotClient();
const result = await analyzeFunction(code, 'test', context);
```

## Showcasing Copilot in Demo

### Visual Indicators
```typescript
// Always show when Copilot is working
console.log(chalk.cyan('🤖 GitHub Copilot is thinking...'));

// Show intermediate steps
console.log(chalk.gray('  └─ Understanding code semantics'));
console.log(chalk.gray('  └─ Detecting patterns'));
console.log(chalk.gray('  └─ Generating insights'));

// Show final result
console.log(chalk.green('✓ Copilot analysis complete'));
```

### Verbose Mode
```typescript
// --copilot-explain flag shows full prompts and responses
if (flags.copilotExplain) {
  console.log(chalk.blue('\n📝 Prompt sent to Copilot:'));
  console.log(prompt);
  console.log(chalk.blue('\n💬 Copilot response:'));
  console.log(response);
}
```

## Summary

GitHub Copilot CLI is integrated at every level of DocuMate:
- **Code Analysis**: Understanding semantic meaning
- **Drift Detection**: Comparing versions intelligently  
- **Documentation Generation**: Writing human-quality docs
- **Example Validation**: Fixing broken examples
- **Prioritization**: Context-aware ranking
- **Conversation**: Natural language interface

Without Copilot, DocuMate would be a basic pattern matcher. With Copilot, it becomes a true AI assistant that understands code, explains decisions, and generates high-quality documentation.
