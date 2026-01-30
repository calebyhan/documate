import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { metrics } from '../../src/utils/metrics.js';

describe('Metrics Collector', () => {
  beforeEach(() => {
    // Reset metrics before each test
    metrics.reset();
  });

  describe('Copilot call tracking', () => {
    it('should track explain calls', () => {
      metrics.recordCopilotCall('explain', 1000, false);
      const data = metrics.getMetrics();

      assert.strictEqual(data.copilot.totalCalls, 1);
      assert.strictEqual(data.copilot.callsByType.explain, 1);
      assert.strictEqual(data.copilot.callsByType.suggest, 0);
    });

    it('should track suggest calls', () => {
      metrics.recordCopilotCall('suggest', 500, false);
      const data = metrics.getMetrics();

      assert.strictEqual(data.copilot.totalCalls, 1);
      assert.strictEqual(data.copilot.callsByType.suggest, 1);
    });

    it('should track cached responses separately', () => {
      metrics.recordCopilotCall('explain', 1000, false);
      metrics.recordCopilotCall('explain', 0, true);

      const data = metrics.getMetrics();
      assert.strictEqual(data.copilot.totalCalls, 2);
      assert.strictEqual(data.copilot.cachedResponses, 1);
    });

    it('should calculate average duration correctly', () => {
      metrics.recordCopilotCall('explain', 1000, false);
      metrics.recordCopilotCall('suggest', 2000, false);

      const data = metrics.getMetrics();
      assert.strictEqual(data.copilot.averageDuration, 1500); // (1000 + 2000) / 2
    });

    it('should not include cached calls in duration average', () => {
      metrics.recordCopilotCall('explain', 1000, false);
      metrics.recordCopilotCall('explain', 0, true); // cached

      const data = metrics.getMetrics();
      assert.strictEqual(data.copilot.averageDuration, 1000); // Only non-cached call
    });

    it('should calculate cache hit rate', () => {
      metrics.recordCopilotCall('explain', 1000, false);
      metrics.recordCopilotCall('explain', 0, true);
      metrics.recordCopilotCall('suggest', 500, false);
      metrics.recordCopilotCall('suggest', 0, true);

      const data = metrics.getMetrics();
      assert.strictEqual(data.performance.cacheHitRate, 50); // 2 out of 4
    });

    it('should track failed calls', () => {
      metrics.recordCopilotFailure();
      metrics.recordCopilotFailure();

      const data = metrics.getMetrics();
      assert.strictEqual(data.copilot.failedCalls, 2);
    });
  });

  describe('Analysis tracking', () => {
    it('should track functions analyzed', () => {
      metrics.recordFunctionsAnalyzed(10);
      metrics.recordFunctionsAnalyzed(5);

      const data = metrics.getMetrics();
      assert.strictEqual(data.analysis.functionsAnalyzed, 15);
    });

    it('should track files scanned', () => {
      metrics.recordFilesScanned(3);
      const data = metrics.getMetrics();
      assert.strictEqual(data.analysis.filesScanned, 3);
    });

    it('should track semantic changes', () => {
      metrics.recordSemanticChange();
      metrics.recordSemanticChange();

      const data = metrics.getMetrics();
      assert.strictEqual(data.analysis.semanticChangesDetected, 2);
    });

    it('should track drift issues', () => {
      metrics.recordDriftIssue();
      const data = metrics.getMetrics();
      assert.strictEqual(data.analysis.driftIssuesFound, 1);
    });

    it('should track documentation generated', () => {
      metrics.recordDocGenerated();
      metrics.recordDocGenerated();
      metrics.recordDocGenerated();

      const data = metrics.getMetrics();
      assert.strictEqual(data.analysis.docsGenerated, 3);
    });
  });

  describe('Summary generation', () => {
    it('should generate summary with all metrics', () => {
      metrics.recordCopilotCall('explain', 1000, false);
      metrics.recordFilesScanned(5);
      metrics.recordFunctionsAnalyzed(20);

      const summary = metrics.getSummary();
      assert.ok(summary.includes('Session Metrics'));
      assert.ok(summary.includes('GitHub Copilot'));
      assert.ok(summary.includes('Analysis'));
    });

    it('should not show empty sections', () => {
      // Don't record any Copilot calls
      metrics.recordFilesScanned(5);

      const summary = metrics.getSummary();
      assert.ok(!summary.includes('GitHub Copilot'));
      assert.ok(summary.includes('Analysis'));
    });
  });

  describe('Session duration', () => {
    it('should track session duration', async () => {
      const before = metrics.getSessionDuration();
      await new Promise(resolve => setTimeout(resolve, 10));
      const after = metrics.getSessionDuration();

      assert.ok(after > before);
    });
  });

  describe('Reset functionality', () => {
    it('should reset all metrics', () => {
      metrics.recordCopilotCall('explain', 1000, false);
      metrics.recordFilesScanned(5);
      metrics.recordSemanticChange();

      metrics.reset();

      const data = metrics.getMetrics();
      assert.strictEqual(data.copilot.totalCalls, 0);
      assert.strictEqual(data.analysis.filesScanned, 0);
      assert.strictEqual(data.analysis.semanticChangesDetected, 0);
    });
  });
});
