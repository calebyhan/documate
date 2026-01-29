export function analyzeCodePrompt(code: string, functionName: string, context: string): string {
  return `Analyze this ${functionName} function and respond in JSON format:

\`\`\`typescript
${code}
\`\`\`

Context: ${context}

Respond with this exact JSON structure:
{
  "purpose": "What does this function do in plain English?",
  "complexity": {
    "score": <1-10>,
    "reasoning": "Why this complexity score?"
  },
  "parameters": [
    {
      "name": "param name",
      "purpose": "what is it for?"
    }
  ],
  "returnValue": {
    "type": "return type",
    "description": "what does it return?"
  },
  "errorConditions": ["list of possible errors"],
  "documentationPriority": {
    "score": <1-10>,
    "reasoning": "why this priority?"
  }
}`;
}

export function detectDriftPrompt(oldCode: string, newCode: string, currentDocs: string): string {
  return `Compare these code versions and identify SEMANTIC changes that affect documentation:

OLD VERSION:
\`\`\`typescript
${oldCode}
\`\`\`

NEW VERSION:
\`\`\`typescript
${newCode}
\`\`\`

CURRENT DOCUMENTATION:
${currentDocs}

IMPORTANT: Distinguish between cosmetic changes (formatting, variable renames) and semantic changes (behavior, API, logic).

Respond in JSON:
{
  "hasSemanticChanges": true/false,
  "changes": [
    {
      "type": "parameter_added|parameter_removed|return_type_changed|behavior_changed|breaking_change",
      "description": "what changed",
      "impact": "how does this affect users?",
      "severity": "critical|high|medium|low",
      "isBreaking": true/false
    }
  ],
  "driftScore": <1-10>,
  "recommendation": "specific action to take"
}`;
}

export function generateDocPrompt(code: string, style: string): string {
  return `Generate ${style} documentation for this function:

\`\`\`typescript
${code}
\`\`\`

Generate complete documentation in ${style} format. Include:
- Clear description of what the function does
- All parameters with types and descriptions
- Return value description
- At least one practical usage example
- Any important notes or warnings

Output only the JSDoc comment block, nothing else.`;
}

export function fixExamplePrompt(example: string, currentCode: string, error: string): string {
  return `This documentation example is broken. Fix it for the current API:

EXAMPLE FROM DOCS:
\`\`\`typescript
${example}
\`\`\`

CURRENT FUNCTION:
\`\`\`typescript
${currentCode}
\`\`\`

ERROR:
${error}

Respond in JSON:
{
  "explanation": "what changed and why the example broke",
  "fixedExample": "corrected code",
  "isBreakingChange": true/false,
  "migrationNotes": "how to update existing code"
}`;
}
