/**
 * Metrics tracking for Copilot usage and performance
 */

export interface MetricsData {
  copilot: {
    totalCalls: number;
    cachedResponses: number;
    failedCalls: number;
    totalDuration: number; // milliseconds
    averageDuration: number;
    callsByType: {
      explain: number;
      suggest: number;
    };
  };
  analysis: {
    functionsAnalyzed: number;
    filesScanned: number;
    semanticChangesDetected: number;
    driftIssuesFound: number;
    docsGenerated: number;
  };
  performance: {
    cacheHitRate: number; // percentage
    averageResponseTime: number; // milliseconds
  };
}

class MetricsCollector {
  private metrics: MetricsData;
  private sessionStart: number;

  constructor() {
    this.sessionStart = Date.now();
    this.metrics = this.createEmptyMetrics();
  }

  private createEmptyMetrics(): MetricsData {
    return {
      copilot: {
        totalCalls: 0,
        cachedResponses: 0,
        failedCalls: 0,
        totalDuration: 0,
        averageDuration: 0,
        callsByType: {
          explain: 0,
          suggest: 0,
        },
      },
      analysis: {
        functionsAnalyzed: 0,
        filesScanned: 0,
        semanticChangesDetected: 0,
        driftIssuesFound: 0,
        docsGenerated: 0,
      },
      performance: {
        cacheHitRate: 0,
        averageResponseTime: 0,
      },
    };
  }

  recordCopilotCall(type: 'explain' | 'suggest', duration: number, fromCache: boolean): void {
    this.metrics.copilot.totalCalls++;
    this.metrics.copilot.callsByType[type]++;

    if (fromCache) {
      this.metrics.copilot.cachedResponses++;
    } else {
      this.metrics.copilot.totalDuration += duration;
    }

    this.updateAverages();
  }

  recordCopilotFailure(): void {
    this.metrics.copilot.failedCalls++;
  }

  recordFunctionsAnalyzed(count: number): void {
    this.metrics.analysis.functionsAnalyzed += count;
  }

  recordFilesScanned(count: number): void {
    this.metrics.analysis.filesScanned += count;
  }

  recordSemanticChange(): void {
    this.metrics.analysis.semanticChangesDetected++;
  }

  recordDriftIssue(): void {
    this.metrics.analysis.driftIssuesFound++;
  }

  recordDocGenerated(): void {
    this.metrics.analysis.docsGenerated++;
  }

  private updateAverages(): void {
    const { totalCalls, cachedResponses, totalDuration } = this.metrics.copilot;
    const actualCalls = totalCalls - cachedResponses;

    if (actualCalls > 0) {
      this.metrics.copilot.averageDuration = Math.round(totalDuration / actualCalls);
      this.metrics.performance.averageResponseTime = this.metrics.copilot.averageDuration;
    }

    if (totalCalls > 0) {
      this.metrics.performance.cacheHitRate = Math.round((cachedResponses / totalCalls) * 100);
    }
  }

  getMetrics(): MetricsData {
    return { ...this.metrics };
  }

  getSessionDuration(): number {
    return Date.now() - this.sessionStart;
  }

  getSummary(): string {
    const m = this.metrics;
    const lines: string[] = [];

    lines.push('📊 Session Metrics');
    lines.push('');

    if (m.copilot.totalCalls > 0) {
      lines.push('🤖 GitHub Copilot:');
      lines.push(`   Total API calls: ${m.copilot.totalCalls}`);
      lines.push(`   Cache hits: ${m.copilot.cachedResponses} (${m.performance.cacheHitRate}%)`);
      lines.push(`   Failed calls: ${m.copilot.failedCalls}`);
      lines.push(`   Average response time: ${m.copilot.averageDuration}ms`);
      lines.push(`   Explain calls: ${m.copilot.callsByType.explain}`);
      lines.push(`   Suggest calls: ${m.copilot.callsByType.suggest}`);
      lines.push('');
    }

    if (m.analysis.filesScanned > 0 || m.analysis.functionsAnalyzed > 0) {
      lines.push('📈 Analysis:');
      if (m.analysis.filesScanned > 0) {
        lines.push(`   Files scanned: ${m.analysis.filesScanned}`);
      }
      if (m.analysis.functionsAnalyzed > 0) {
        lines.push(`   Functions analyzed: ${m.analysis.functionsAnalyzed}`);
      }
      if (m.analysis.semanticChangesDetected > 0) {
        lines.push(`   Semantic changes detected: ${m.analysis.semanticChangesDetected}`);
      }
      if (m.analysis.driftIssuesFound > 0) {
        lines.push(`   Drift issues found: ${m.analysis.driftIssuesFound}`);
      }
      if (m.analysis.docsGenerated > 0) {
        lines.push(`   Documentation generated: ${m.analysis.docsGenerated}`);
      }
      lines.push('');
    }

    const sessionSec = Math.round(this.getSessionDuration() / 1000);
    lines.push(`⏱️  Session duration: ${sessionSec}s`);

    return lines.join('\n');
  }

  reset(): void {
    this.metrics = this.createEmptyMetrics();
    this.sessionStart = Date.now();
  }
}

// Global singleton instance
export const metrics = new MetricsCollector();
