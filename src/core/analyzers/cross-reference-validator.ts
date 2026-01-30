import type {
  MarkdownScanResult,
  CodeScanResult,
  CrossReferenceValidationResult,
  CodeReferenceInfo,
} from '../../types/index.js';

export class CrossReferenceValidator {
  async validateCrossReferences(
    markdownResults: MarkdownScanResult[],
    codeResults: CodeScanResult[],
  ): Promise<CrossReferenceValidationResult[]> {
    const reports: CrossReferenceValidationResult[] = [];

    // Build a lookup index of all code symbols
    const codeIndex = this.buildCodeIndex(codeResults);

    for (const mdResult of markdownResults) {
      const report = this.validateMarkdownFile(mdResult, codeIndex, codeResults);
      reports.push(report);
    }

    return reports;
  }

  private buildCodeIndex(codeResults: CodeScanResult[]): Map<string, Set<string>> {
    const index = new Map<string, Set<string>>();

    for (const result of codeResults) {
      // Index functions
      for (const func of result.functions) {
        this.addToIndex(index, func.name, result.file);
      }

      // Index classes
      for (const cls of result.classes) {
        this.addToIndex(index, cls.name, result.file);

        // Index class methods
        for (const method of cls.methods) {
          this.addToIndex(index, method.name, result.file);
          // Also index as ClassName.methodName
          this.addToIndex(index, `${cls.name}.${method.name}`, result.file);
        }
      }
    }

    return index;
  }

  private addToIndex(index: Map<string, Set<string>>, symbol: string, file: string): void {
    if (!index.has(symbol)) {
      index.set(symbol, new Set());
    }
    index.get(symbol)!.add(file);
  }

  private validateMarkdownFile(
    mdResult: MarkdownScanResult,
    codeIndex: Map<string, Set<string>>,
    codeResults: CodeScanResult[],
  ): CrossReferenceValidationResult {
    const brokenReferences: Array<{
      reference: string;
      location: string;
      lineNumber: number;
      suggestion?: string;
    }> = [];
    const validReferences: Array<{ reference: string; foundIn: string[] }> = [];
    const warnings: string[] = [];

    // Validate code references
    for (const ref of mdResult.codeReferences) {
      const validation = this.validateCodeReference(ref, codeIndex);

      if (validation.isValid) {
        validReferences.push({
          reference: ref.name,
          foundIn: Array.from(validation.foundIn || []),
        });
      } else {
        brokenReferences.push({
          reference: ref.name,
          location: `${ref.type} reference`,
          lineNumber: ref.line,
          suggestion: validation.suggestion,
        });
      }
    }

    // Validate code blocks with language tags
    for (const codeBlock of mdResult.codeBlocks) {
      if (codeBlock.language && this.isValidatableLanguage(codeBlock.language)) {
        const blockValidation = this.validateCodeBlock(codeBlock.code, codeIndex);

        if (blockValidation.brokenRefs.length > 0) {
          warnings.push(
            `Code block at line ${codeBlock.line} references undefined symbols: ${blockValidation.brokenRefs.join(', ')}`,
          );
        }
      }
    }

    // Check for orphaned documentation
    const orphanedDocs = this.findOrphanedDocumentation(mdResult, codeResults);
    if (orphanedDocs.length > 0) {
      warnings.push(
        `Documentation may be orphaned (code no longer exists): ${orphanedDocs.join(', ')}`,
      );
    }

    return {
      file: mdResult.file,
      totalReferences: mdResult.codeReferences.length,
      brokenReferences,
      validReferences,
      warnings,
    };
  }

  private validateCodeReference(
    ref: CodeReferenceInfo,
    codeIndex: Map<string, Set<string>>,
  ): { isValid: boolean; foundIn?: Set<string>; suggestion?: string } {
    const identifier = ref.name;

    // Direct match
    if (codeIndex.has(identifier)) {
      return { isValid: true, foundIn: codeIndex.get(identifier) };
    }

    // Try case-insensitive match
    const lowerIdentifier = identifier.toLowerCase();
    for (const [key, files] of codeIndex) {
      if (key.toLowerCase() === lowerIdentifier) {
        return {
          isValid: false,
          suggestion: `Did you mean "${key}"? (case mismatch)`,
        };
      }
    }

    // Try fuzzy matching for common mistakes
    const fuzzyMatches = this.findFuzzyMatches(identifier, codeIndex);
    if (fuzzyMatches.length > 0) {
      return {
        isValid: false,
        suggestion: `Did you mean: ${fuzzyMatches.slice(0, 3).join(', ')}?`,
      };
    }

    return { isValid: false };
  }

  private validateCodeBlock(
    content: string,
    codeIndex: Map<string, Set<string>>,
  ): { brokenRefs: string[] } {
    const brokenRefs: string[] = [];

    // Extract potential function calls and class names from code block
    const functionCallPattern = /\b([a-z][a-zA-Z0-9]*)\s*\(/g;
    const classNamePattern = /\b([A-Z][a-zA-Z0-9]*)\b/g;

    // Check function calls
    let match;
    while ((match = functionCallPattern.exec(content)) !== null) {
      const funcName = match[1];
      if (!codeIndex.has(funcName)) {
        brokenRefs.push(funcName);
      }
    }

    // Check class names
    while ((match = classNamePattern.exec(content)) !== null) {
      const className = match[1];
      // Ignore common keywords
      if (!this.isCommonKeyword(className) && !codeIndex.has(className)) {
        brokenRefs.push(className);
      }
    }

    return { brokenRefs: [...new Set(brokenRefs)] }; // Remove duplicates
  }

  private findFuzzyMatches(identifier: string, codeIndex: Map<string, Set<string>>): string[] {
    const matches: string[] = [];
    const lowerIdentifier = identifier.toLowerCase();

    for (const key of codeIndex.keys()) {
      const lowerKey = key.toLowerCase();

      // Check if keys are similar (simple Levenshtein-like check)
      if (this.isSimilar(lowerIdentifier, lowerKey)) {
        matches.push(key);
      }
    }

    return matches;
  }

  private isSimilar(a: string, b: string): boolean {
    // Simple similarity check: starts with same letter and length is close
    if (a[0] !== b[0]) return false;

    const lengthDiff = Math.abs(a.length - b.length);
    if (lengthDiff > 3) return false;

    // Count matching characters
    let matches = 0;
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      if (a[i] === b[i]) matches++;
    }

    return matches / minLen > 0.6; // 60% character match
  }

  private findOrphanedDocumentation(
    mdResult: MarkdownScanResult,
    codeResults: CodeScanResult[],
  ): string[] {
    const orphaned: string[] = [];

    // Check if sections reference code files that no longer exist
    for (const section of mdResult.sections) {
      const title = section.title.toLowerCase();

      // Look for patterns like "Using FooBar" or "FooBar API"
      const potentialCodeRefs = title.match(/\b([A-Z][a-zA-Z0-9]+)\b/g);

      if (potentialCodeRefs) {
        for (const ref of potentialCodeRefs) {
          // Check if this reference exists in code
          const exists = codeResults.some(
            (cr) =>
              cr.classes.some((c) => c.name === ref) || cr.functions.some((f) => f.name === ref),
          );

          if (!exists && !this.isCommonKeyword(ref)) {
            orphaned.push(ref);
          }
        }
      }
    }

    return [...new Set(orphaned)]; // Remove duplicates
  }

  private isValidatableLanguage(lang: string): boolean {
    const validatable = ['typescript', 'javascript', 'ts', 'js', 'python', 'py'];
    return validatable.includes(lang.toLowerCase());
  }

  private isCommonKeyword(word: string): boolean {
    const keywords = [
      'API',
      'HTTP',
      'JSON',
      'URL',
      'CLI',
      'Git',
      'GitHub',
      'Array',
      'String',
      'Number',
      'Boolean',
      'Object',
      'Promise',
      'Error',
      'Type',
      'Interface',
      'Class',
      'Function',
      'Method',
      'Property',
      'Parameter',
      'Return',
      'Value',
    ];

    return keywords.includes(word);
  }
}
