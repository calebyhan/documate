import type { ScanResult, FunctionInfo, DriftReport, SemanticChange } from '../../types/index.js';
import type { GitAnalyzer } from '../../integrations/git.js';
import type { CopilotWrapper } from '../../copilot/wrapper.js';
import { detectDriftPrompt } from '../../copilot/prompts.js';
import { TypeScriptScanner } from '../scanners/typescript-scanner.js';
import { relative } from 'node:path';

export class DriftAnalyzer {
  constructor(
    private git: GitAnalyzer,
    private copilot?: CopilotWrapper,
  ) {}

  async analyzeDrift(scanResults: ScanResult[]): Promise<DriftReport[]> {
    const reports: DriftReport[] = [];

    for (const result of scanResults) {
      const fileReports = await this.analyzeFileDrift(result.file, result.functions);
      reports.push(...fileReports);
    }

    return reports.sort((a, b) => b.driftScore - a.driftScore);
  }

  async analyzeFileDrift(filePath: string, functions: FunctionInfo[]): Promise<DriftReport[]> {
    const reports: DriftReport[] = [];
    const relPath = relative(process.cwd(), filePath);

    const history = await this.git.getFileHistory(relPath, 5);
    if (history.length < 2) return reports;

    const [latest, previous] = history;
    const oldContent = await this.git.getFileAtCommit(relPath, previous.hash);
    if (!oldContent) return reports;

    // Parse the old version
    const scanner = new TypeScriptScanner();
    let oldResult: ScanResult;
    try {
      // Create a temp parse of old content
      const ts = await import('typescript');
      const oldSourceFile = ts.default.createSourceFile(
        filePath,
        oldContent,
        ts.default.ScriptTarget.Latest,
        true,
      );
      oldResult = await scanner.scanFile(filePath);
      // We need to compare against the old functions by name
    } catch {
      return reports;
    }

    for (const fn of functions) {
      if (!fn.hasDocumentation) continue; // Only check documented functions for drift

      // Find same function in old version by name
      const oldFn = this.findFunctionInContent(oldContent, fn.name);
      if (!oldFn) continue; // Function is new, no drift

      const currentCode = this.getFunctionCode(fn);

      // Simple heuristic: check if signature changed
      const changes = this.detectSignatureChanges(fn, oldContent, fn.name);
      if (changes.length === 0) continue;

      let driftScore = Math.min(changes.length * 2, 10);
      let recommendation = 'Update documentation to reflect code changes';

      // Try Copilot for deeper analysis
      if (this.copilot) {
        try {
          const response = await this.copilot.explain(
            detectDriftPrompt(oldFn, currentCode, fn.documentation ?? ''),
          );
          if (response.parsed) {
            const parsed = response.parsed as Record<string, unknown>;
            if (typeof parsed.driftScore === 'number') driftScore = parsed.driftScore;
            if (typeof parsed.recommendation === 'string') recommendation = parsed.recommendation;
          }
        } catch {
          // Use heuristic results
        }
      }

      reports.push({
        file: filePath,
        functionName: fn.name,
        driftScore,
        lastCodeChange: new Date(latest.date),
        lastDocUpdate: new Date(previous.date),
        changes,
        recommendation,
      });
    }

    return reports;
  }

  private findFunctionInContent(content: string, name: string): string | null {
    // Simple regex to find function in old content
    const patterns = [
      new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)[^{]*\\{`, 's'),
      new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*(?:async\\s+)?(?:\\([^)]*\\)|[^=]*)\\s*=>`, 's'),
      new RegExp(`${name}\\s*\\([^)]*\\)\\s*(?::\\s*\\w+)?\\s*\\{`, 's'),
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        // Extract a rough function body
        const start = match.index!;
        let braces = 0;
        let end = start;
        for (let i = start; i < content.length; i++) {
          if (content[i] === '{') braces++;
          if (content[i] === '}') {
            braces--;
            if (braces === 0) {
              end = i + 1;
              break;
            }
          }
        }
        return content.substring(start, end);
      }
    }

    return null;
  }

  private getFunctionCode(fn: FunctionInfo): string {
    // This is a placeholder - ideally we'd read the actual source
    return `function ${fn.name}(${fn.params.map((p) => `${p.name}: ${p.type}`).join(', ')}): ${fn.returnType}`;
  }

  private detectSignatureChanges(
    fn: FunctionInfo,
    oldContent: string,
    name: string,
  ): SemanticChange[] {
    const changes: SemanticChange[] = [];
    const oldFnStr = this.findFunctionInContent(oldContent, name);
    if (!oldFnStr) return changes;

    // Extract old params (rough)
    const oldParamMatch = oldFnStr.match(/\(([^)]*)\)/);
    if (oldParamMatch) {
      const oldParams = oldParamMatch[1]
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      // Check param count change
      if (oldParams.length !== fn.params.length) {
        const diff = fn.params.length - oldParams.length;
        changes.push({
          type: diff > 0 ? 'parameter_added' : 'parameter_removed',
          description: `Parameter count changed from ${oldParams.length} to ${fn.params.length}`,
          impact: 'Function signature has changed',
          severity: 'high',
          isBreaking: diff < 0,
        });
      }
    }

    return changes;
  }
}
