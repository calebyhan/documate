export interface CodeExample {
  code: string;
  lineNumber: number;
  language: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class ExampleValidator {
  extractExamples(documentation: string): CodeExample[] {
    const examples: CodeExample[] = [];
    const regex = /@example\s*\n([\s\S]*?)(?=\n\s*\*\s*@|\n\s*\*\/)/g;

    let match;
    while ((match = regex.exec(documentation)) !== null) {
      const code = match[1]
        .split('\n')
        .map((line) => line.replace(/^\s*\*\s?/, ''))
        .join('\n')
        .trim();

      if (code) {
        examples.push({
          code,
          lineNumber: 0,
          language: 'typescript',
        });
      }
    }

    return examples;
  }

  async validateExample(example: CodeExample): Promise<ValidationResult> {
    // Basic syntax validation - check for obvious issues
    try {
      const ts = await import('typescript');
      const sourceFile = ts.default.createSourceFile(
        'example.ts',
        example.code,
        ts.default.ScriptTarget.Latest,
        true,
      );

      // Check for syntax errors
      const diagnostics = (sourceFile as unknown as { parseDiagnostics?: { length: number; map: (fn: (d: { messageText: unknown }) => string) => string[] } }).parseDiagnostics;
      if (diagnostics && diagnostics.length > 0) {
        return {
          isValid: false,
          error: `Syntax error: ${diagnostics.map((d: { messageText: unknown }) => String(d.messageText)).join(', ')}`,
        };
      }

      return { isValid: true };
    } catch (err) {
      return {
        isValid: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
