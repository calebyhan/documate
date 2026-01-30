import type { CodeScanResult, HealthReport, DebtIssue } from '../../types/index.js';
import { DebtAnalyzer } from './debt-analyzer.js';

export class HealthCalculator {
  private debtAnalyzer = new DebtAnalyzer();

  calculateHealth(scanResults: CodeScanResult[]): HealthReport {
    const coverage = this.calculateCoverage(scanResults);
    const freshness = 100; // Requires drift data, default to 100%
    const accuracy = 100; // Requires example validation, default to 100%
    const completeness = this.calculateCompleteness(scanResults);

    const overallScore = Math.round(
      coverage * 0.3 + freshness * 0.3 + accuracy * 0.2 + completeness * 0.2,
    );

    const issues = this.debtAnalyzer.analyze(scanResults);

    return {
      overallScore,
      coverage,
      freshness,
      accuracy,
      completeness,
      issues,
    };
  }

  private calculateCoverage(results: CodeScanResult[]): number {
    let total = 0;
    let documented = 0;

    for (const result of results) {
      for (const fn of result.functions) {
        total++;
        if (fn.hasDocumentation) documented++;
      }
      for (const cls of result.classes) {
        for (const method of cls.methods) {
          total++;
          if (method.hasDocumentation) documented++;
        }
      }
    }

    return total > 0 ? Math.round((documented / total) * 100) : 100;
  }

  private calculateCompleteness(results: CodeScanResult[]): number {
    let totalScore = 0;
    let count = 0;

    for (const result of results) {
      for (const fn of result.functions) {
        if (!fn.hasDocumentation || !fn.documentation) continue;
        totalScore += this.scoreFunctionCompleteness(fn.documentation, fn);
        count++;
      }
      for (const cls of result.classes) {
        for (const method of cls.methods) {
          if (!method.hasDocumentation || !method.documentation) continue;
          totalScore += this.scoreFunctionCompleteness(method.documentation, method);
          count++;
        }
      }
    }

    return count > 0 ? Math.round((totalScore / count) * 100) : 100;
  }

  private scoreFunctionCompleteness(doc: string, fn: { params: { name: string }[]; returnType: string }): number {
    let points = 0;
    let maxPoints = 0;

    // Has description (beyond just tags)
    maxPoints++;
    const lines = doc.split('\n').filter((l) => !l.trim().startsWith('* @') && l.trim() !== '/**' && l.trim() !== '*/');
    if (lines.some((l) => l.replace(/\*/g, '').trim().length > 0)) {
      points++;
    }

    // All params documented
    if (fn.params.length > 0) {
      maxPoints++;
      const allParamsDocumented = fn.params.every((p) => doc.includes(p.name));
      if (allParamsDocumented) points++;
    }

    // Return documented
    if (fn.returnType !== 'void' && fn.returnType !== 'unknown') {
      maxPoints++;
      if (doc.includes('@returns') || doc.includes('@return')) points++;
    }

    // Has example
    maxPoints++;
    if (doc.includes('@example')) points++;

    return maxPoints > 0 ? points / maxPoints : 1;
  }
}
