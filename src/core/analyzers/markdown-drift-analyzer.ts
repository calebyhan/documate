import type { GitAnalyzer } from '../../integrations/git.js';
import type {
  MarkdownScanResult,
  CodeScanResult,
  MarkdownDriftFileReport,
} from '../../types/index.js';

export class MarkdownDriftAnalyzer {
  constructor(private git: GitAnalyzer) {}

  async analyzeDrift(
    markdownResults: MarkdownScanResult[],
    codeResults: CodeScanResult[],
    commitLimit: number = 10,
  ): Promise<MarkdownDriftFileReport[]> {
    const reports: MarkdownDriftFileReport[] = [];

    for (const mdResult of markdownResults) {
      const report = await this.analyzeMarkdownFile(mdResult, codeResults, commitLimit);
      reports.push(report);
    }

    return reports;
  }

  private async analyzeMarkdownFile(
    mdResult: MarkdownScanResult,
    codeResults: CodeScanResult[],
    commitLimit: number,
  ): Promise<MarkdownDriftFileReport> {
    const outdatedSections: Array<{
      section: string;
      reason: string;
      lineNumber: number;
    }> = [];
    const staleReferences: Array<{
      reference: string;
      lastModified: string;
      codeLastModified: string;
    }> = [];
    const suggestions: string[] = [];

    // Get last modification date of the markdown file
    const mdLastModified = await this.getLastModifiedDate(mdResult.file);

    // Check each code reference to see if the code was modified after the markdown
    for (const ref of mdResult.codeReferences) {
      const codeFile = this.findCodeFileForReference(ref.name, codeResults);

      if (codeFile) {
        const codeLastModified = await this.getLastModifiedDate(codeFile);

        if (codeLastModified && mdLastModified && codeLastModified > mdLastModified) {
          staleReferences.push({
            reference: ref.name,
            lastModified: mdLastModified,
            codeLastModified: codeLastModified,
          });
        }
      }
    }

    // Check code blocks for outdated examples
    for (const codeBlock of mdResult.codeBlocks) {
      if (this.isCodeExample(codeBlock.code)) {
        const validation = await this.validateCodeExample(codeBlock.code, codeResults);

        if (!validation.isValid) {
          outdatedSections.push({
            section: `Code block at line ${codeBlock.line}`,
            reason: validation.reason,
            lineNumber: codeBlock.line,
          });
        }
      }
    }

    // Check if code files referenced in sections have been significantly modified
    const referencedFiles = this.extractFileReferences(mdResult);
    for (const fileRef of referencedFiles) {
      const changes = await this.getRecentChanges(fileRef, commitLimit);

      if (changes.significantChanges > 5) {
        suggestions.push(
          `File "${fileRef}" has ${changes.significantChanges} recent changes - documentation may need updating`,
        );
      }
    }

    // Calculate drift score (0-100, lower is better)
    let driftScore = 0;

    if (staleReferences.length > 0) {
      driftScore += staleReferences.length * 10;
    }

    if (outdatedSections.length > 0) {
      driftScore += outdatedSections.length * 15;
    }

    driftScore = Math.min(100, driftScore);

    return {
      file: mdResult.file,
      driftScore,
      lastModified: mdLastModified || 'unknown',
      outdatedSections,
      staleReferences,
      suggestions,
    };
  }

  private async getLastModifiedDate(filePath: string): Promise<string | null> {
    try {
      const date = await this.git.getLastModified(filePath);
      return date.toISOString();
    } catch {
      return null;
    }
  }

  private findCodeFileForReference(identifier: string, codeResults: CodeScanResult[]): string | null {
    for (const result of codeResults) {
      // Check functions
      if (result.functions.some((f) => f.name === identifier)) {
        return result.file;
      }

      // Check classes
      if (result.classes.some((c) => c.name === identifier)) {
        return result.file;
      }

      // Check methods
      for (const cls of result.classes) {
        if (cls.methods.some((m) => m.name === identifier)) {
          return result.file;
        }
      }
    }

    return null;
  }

  private isCodeExample(content: string): boolean {
    // Heuristic: if the code block contains function calls or imports, it's likely an example
    const hasImport = /^(import|from|require)\s/m.test(content);
    const hasFunctionCall = /\w+\s*\([^)]*\)/.test(content);
    const hasAssignment = /\w+\s*[=:]\s*/.test(content);

    return hasImport || hasFunctionCall || hasAssignment;
  }

  private async validateCodeExample(
    content: string,
    codeResults: CodeScanResult[],
  ): Promise<{ isValid: boolean; reason: string }> {
    // Extract function calls and identifiers from the example
    const functionCalls = this.extractFunctionCalls(content);
    const identifiers = this.extractIdentifiers(content);

    // Build a set of all known symbols
    const knownSymbols = new Set<string>();
    for (const result of codeResults) {
      for (const func of result.functions) {
        knownSymbols.add(func.name);
      }
      for (const cls of result.classes) {
        knownSymbols.add(cls.name);
        for (const method of cls.methods) {
          knownSymbols.add(method.name);
        }
      }
    }

    // Check if referenced symbols exist
    const missingSymbols: string[] = [];
    for (const call of functionCalls) {
      if (!knownSymbols.has(call)) {
        missingSymbols.push(call);
      }
    }

    for (const id of identifiers) {
      if (!knownSymbols.has(id) && !this.isCommonBuiltin(id)) {
        missingSymbols.push(id);
      }
    }

    if (missingSymbols.length > 0) {
      return {
        isValid: false,
        reason: `References undefined symbols: ${[...new Set(missingSymbols)].slice(0, 3).join(', ')}`,
      };
    }

    return { isValid: true, reason: '' };
  }

  private extractFunctionCalls(content: string): string[] {
    const calls: string[] = [];
    const pattern = /\b([a-z][a-zA-Z0-9]*)\s*\(/g;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      calls.push(match[1]);
    }

    return [...new Set(calls)];
  }

  private extractIdentifiers(content: string): string[] {
    const identifiers: string[] = [];
    const pattern = /\b([A-Z][a-zA-Z0-9]*)\b/g;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      identifiers.push(match[1]);
    }

    return [...new Set(identifiers)];
  }

  private extractFileReferences(mdResult: MarkdownScanResult): string[] {
    const files: string[] = [];

    // Look for file paths in the content
    const filePattern = /(?:['"`])([^'"`]*\.(ts|tsx|js|jsx|py))(?:['"`])/g;

    for (const section of mdResult.sections) {
      let match;
      while ((match = filePattern.exec(section.content)) !== null) {
        files.push(match[1]);
      }
    }

    return [...new Set(files)];
  }

  private async getRecentChanges(
    filePath: string,
    commitLimit: number,
  ): Promise<{ significantChanges: number }> {
    try {
      const history = await this.git.getFileHistory(filePath, commitLimit);
      return { significantChanges: history.length };
    } catch {
      return { significantChanges: 0 };
    }
  }

  private isCommonBuiltin(identifier: string): boolean {
    const builtins = [
      'String',
      'Number',
      'Boolean',
      'Array',
      'Object',
      'Function',
      'Promise',
      'Error',
      'Date',
      'Map',
      'Set',
      'RegExp',
    ];

    return builtins.includes(identifier);
  }
}
