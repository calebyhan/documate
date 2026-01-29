import type { ScanResult, FunctionInfo, DebtIssue } from '../../types/index.js';

export class DebtAnalyzer {
  analyze(scanResults: ScanResult[]): DebtIssue[] {
    const issues: DebtIssue[] = [];

    for (const result of scanResults) {
      // Check standalone functions
      for (const fn of result.functions) {
        if (!fn.hasDocumentation) {
          issues.push(this.createMissingDocIssue(result.file, fn));
        } else {
          const incomplete = this.checkCompleteness(result.file, fn);
          if (incomplete) {
            issues.push(incomplete);
          }
        }
      }

      // Check class methods
      for (const cls of result.classes) {
        if (!cls.hasDocumentation && cls.isExported) {
          issues.push({
            file: result.file,
            functionName: cls.name,
            severity: 'high',
            priority: 60,
            reason: `Exported class "${cls.name}" is missing documentation`,
          });
        }

        for (const method of cls.methods) {
          if (!method.hasDocumentation && method.visibility !== 'private') {
            issues.push(this.createMissingDocIssue(result.file, method));
          }
        }
      }
    }

    return issues.sort((a, b) => b.priority - a.priority);
  }

  private createMissingDocIssue(file: string, fn: FunctionInfo): DebtIssue {
    const priority = this.calculatePriority(fn);
    const severity = this.getSeverity(priority);

    const reasons: string[] = [];
    if (fn.isExported) reasons.push('exported');
    if (fn.complexity.cyclomaticComplexity > 5) reasons.push('complex');
    if (fn.params.length > 3) reasons.push(`${fn.params.length} parameters`);
    if (fn.isAsync) reasons.push('async');

    const detail = reasons.length > 0 ? ` (${reasons.join(', ')})` : '';

    return {
      file,
      functionName: fn.name,
      severity,
      priority,
      reason: `Missing documentation for ${fn.type} "${fn.name}"${detail}`,
      suggestion: this.generateSuggestion(fn),
    };
  }

  private checkCompleteness(file: string, fn: FunctionInfo): DebtIssue | null {
    if (!fn.documentation) return null;

    const missing: string[] = [];
    const doc = fn.documentation;

    // Check if params are documented
    for (const param of fn.params) {
      if (!doc.includes(`@param`) || !doc.includes(param.name)) {
        missing.push(`@param ${param.name}`);
      }
    }

    // Check if return is documented
    if (fn.returnType !== 'void' && fn.returnType !== 'unknown' && !doc.includes('@returns') && !doc.includes('@return')) {
      missing.push('@returns');
    }

    if (missing.length === 0) return null;

    return {
      file,
      functionName: fn.name,
      severity: 'low',
      priority: 20,
      reason: `Incomplete documentation: missing ${missing.join(', ')}`,
    };
  }

  private calculatePriority(fn: FunctionInfo): number {
    let score = 0;

    // Visibility (0-30)
    if (fn.isExported && fn.visibility === 'public') score += 30;
    else if (fn.isExported) score += 20;
    else if (fn.visibility === 'public') score += 15;
    else score += 5;

    // Complexity (0-25)
    if (fn.complexity.cyclomaticComplexity > 10) score += 25;
    else if (fn.complexity.cyclomaticComplexity > 5) score += 15;
    else score += 5;

    // Lines of code (0-15)
    if (fn.complexity.linesOfCode > 50) score += 15;
    else if (fn.complexity.linesOfCode > 20) score += 10;
    else score += 3;

    // Parameters (0-10)
    score += Math.min(fn.params.length * 2, 10);

    // Async bonus (0-5)
    if (fn.isAsync) score += 5;

    return Math.min(score, 100);
  }

  private getSeverity(priority: number): DebtIssue['severity'] {
    if (priority >= 70) return 'critical';
    if (priority >= 50) return 'high';
    if (priority >= 30) return 'medium';
    return 'low';
  }

  private generateSuggestion(fn: FunctionInfo): string {
    const parts: string[] = [];

    if (fn.isExported) parts.push('This is part of the public API');
    if (fn.complexity.cyclomaticComplexity > 5) parts.push('has complex logic that needs explanation');
    if (fn.params.length > 2) parts.push(`has ${fn.params.length} parameters that need documentation`);
    if (fn.isAsync) parts.push('async behavior should be documented');

    return parts.length > 0
      ? parts.join(', ')
      : 'Consider adding JSDoc documentation';
  }
}
