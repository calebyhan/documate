import type { CodeScanResult, FunctionInfo, DriftReport, SemanticChange } from '../../types/index.js';
import type { GitAnalyzer } from '../../integrations/git.js';
import type { CopilotWrapper } from '../../copilot/wrapper.js';
import { detectDriftPrompt } from '../../copilot/prompts.js';
import { relative } from 'node:path';
import { logger } from '../../utils/logger.js';
import ts from 'typescript';

export class DriftAnalyzer {
  constructor(
    private git: GitAnalyzer,
    private copilot?: CopilotWrapper,
  ) {}

  async analyzeDrift(scanResults: CodeScanResult[], commitLimit: number = 10, sinceDate?: string): Promise<DriftReport[]> {
    const reports: DriftReport[] = [];

    for (const result of scanResults) {
      const fileReports = await this.analyzeFileDrift(result.file, result.functions, commitLimit, sinceDate);
      reports.push(...fileReports);
    }

    return reports.sort((a, b) => b.driftScore - a.driftScore);
  }

  async analyzeFileDrift(filePath: string, functions: FunctionInfo[], commitLimit: number = 10, sinceDate?: string): Promise<DriftReport[]> {
    const reports: DriftReport[] = [];
    const relPath = relative(process.cwd(), filePath);

    const history = await this.git.getFileHistory(relPath, commitLimit, sinceDate);
    if (history.length < 2) {
      logger.debug(`Insufficient history for ${relPath} (${history.length} commits)`);
      return reports;
    }

    const [latest, previous] = history;
    const oldContent = await this.git.getFileAtCommit(relPath, previous.hash);
    if (!oldContent) {
      logger.warn(`Could not retrieve file content at commit ${previous.hash}`);
      return reports;
    }

    // Parse the old version using TypeScript AST
    let oldFunctions: Map<string, FunctionInfo>;
    try {
      oldFunctions = await this.parseFunctionsFromContent(oldContent, filePath);
      logger.debug(`Parsed ${oldFunctions.size} functions from old version of ${relPath}`);
    } catch (err) {
      logger.error(`Failed to parse old content for ${relPath}: ${err instanceof Error ? err.message : String(err)}`);
      return reports;
    }

    for (const currentFn of functions) {
      if (!currentFn.hasDocumentation) continue; // Only check documented functions for drift

      const oldFn = oldFunctions.get(currentFn.name);
      if (!oldFn) {
        logger.debug(`Function ${currentFn.name} is new, skipping drift analysis`);
        continue; // Function is new, no drift
      }

      // Compare signatures using AST-based semantic comparison
      const changes = this.compareSignatures(oldFn, currentFn);
      if (changes.length === 0) continue;

      let driftScore = this.calculateDriftScore(changes);
      let recommendation = this.generateRecommendation(changes);

      // Try Copilot for deeper semantic analysis
      if (this.copilot) {
        try {
          const oldCode = this.reconstructFunctionCode(oldFn);
          const currentCode = this.reconstructFunctionCode(currentFn);

          const response = await this.copilot.explain(
            detectDriftPrompt(oldCode, currentCode, currentFn.documentation ?? ''),
          );

          if (response.success && response.parsed) {
            const parsed = response.parsed as Record<string, unknown>;
            if (typeof parsed.driftScore === 'number') driftScore = parsed.driftScore;
            if (typeof parsed.recommendation === 'string') recommendation = parsed.recommendation;

            // Merge AI-detected changes with our heuristic changes
            if (Array.isArray(parsed.changes)) {
              const aiChanges = parsed.changes as Array<Record<string, unknown>>;
              for (const change of aiChanges) {
                if (typeof change.type === 'string' &&
                    !changes.some(c => c.type === change.type)) {
                  changes.push({
                    type: change.type,
                    description: String(change.description ?? ''),
                    impact: String(change.impact ?? ''),
                    severity: (change.severity as 'critical' | 'high' | 'medium' | 'low') ?? 'medium',
                    isBreaking: Boolean(change.isBreaking),
                  });
                }
              }
            }
          }
        } catch (err) {
          logger.warn(`Copilot analysis failed for ${currentFn.name}: ${err instanceof Error ? err.message : String(err)}`);
          // Use heuristic results
        }
      }

      reports.push({
        file: filePath,
        functionName: currentFn.name,
        driftScore,
        lastCodeChange: new Date(latest.date),
        lastDocUpdate: new Date(previous.date),
        changes,
        recommendation,
      });
    }

    return reports;
  }

  /**
   * Parse functions from file content using TypeScript AST
   */
  private async parseFunctionsFromContent(content: string, filePath: string): Promise<Map<string, FunctionInfo>> {
    const functionMap = new Map<string, FunctionInfo>();

    try {
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
      );

      // Manually extract functions from the AST
      const visit = (node: ts.Node): void => {
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
          const fnInfo = this.extractFunctionInfo(node, sourceFile, filePath);
          if (fnInfo) {
            functionMap.set(fnInfo.name, fnInfo);
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to parse TypeScript content: ${errorMsg}`);
      throw err;
    }

    return functionMap;
  }

  /**
   * Extract FunctionInfo from a TypeScript AST node
   */
  private extractFunctionInfo(node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction, sourceFile: ts.SourceFile, filePath: string): FunctionInfo | null {
    let name: string;

    if (ts.isFunctionDeclaration(node)) {
      if (!node.name) return null;
      name = node.name.text;
    } else if (ts.isMethodDeclaration(node)) {
      if (!ts.isIdentifier(node.name)) return null;
      name = node.name.text;
    } else {
      // Arrow function - try to get name from parent variable declaration
      const parent = node.parent;
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        name = parent.name.text;
      } else {
        return null;
      }
    }

    const params: Array<{ name: string; type: string; isOptional: boolean }> = [];

    if (node.parameters) {
      for (const param of node.parameters) {
        if (!ts.isIdentifier(param.name)) continue;

        params.push({
          name: param.name.text,
          type: param.type ? param.type.getText() : 'any',
          isOptional: !!param.questionToken,
        });
      }
    }

    const returnType = node.type ? node.type.getText() : 'void';
    const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
    const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;

    const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    return {
      name,
      type: ts.isFunctionDeclaration(node) ? 'function' : ts.isMethodDeclaration(node) ? 'method' : 'arrow',
      params,
      returnType,
      hasDocumentation: false, // We don't check this for old versions
      isExported,
      isAsync,
      visibility: 'public', // Simplified for now
      location: {
        file: filePath,
        startLine: startLine + 1,
        endLine: endLine + 1,
      },
      complexity: {
        linesOfCode: endLine - startLine,
        cyclomaticComplexity: 1, // Simplified
      },
    };
  }

  /**
   * Compare two function signatures semantically and detect changes
   */
  private compareSignatures(oldFn: FunctionInfo, newFn: FunctionInfo): SemanticChange[] {
    const changes: SemanticChange[] = [];

    // Check parameter count changes
    if (oldFn.params.length !== newFn.params.length) {
      const diff = newFn.params.length - oldFn.params.length;
      changes.push({
        type: diff > 0 ? 'parameter_added' : 'parameter_removed',
        description: `Parameter count changed from ${oldFn.params.length} to ${newFn.params.length}`,
        impact: 'Callers may need to update function calls',
        severity: 'high',
        isBreaking: true,
      });
    }

    // Check parameter type changes
    const minParams = Math.min(oldFn.params.length, newFn.params.length);
    for (let i = 0; i < minParams; i++) {
      const oldParam = oldFn.params[i];
      const newParam = newFn.params[i];

      // Check type change
      if (oldParam.type !== newParam.type) {
        changes.push({
          type: 'parameter_type_changed',
          description: `Parameter '${oldParam.name}' type changed from '${oldParam.type}' to '${newParam.type}'`,
          impact: 'Type mismatch may cause compilation errors',
          severity: 'critical',
          isBreaking: true,
        });
      }

      // Check name change (might indicate semantic change)
      if (oldParam.name !== newParam.name) {
        changes.push({
          type: 'parameter_renamed',
          description: `Parameter renamed from '${oldParam.name}' to '${newParam.name}' at position ${i}`,
          impact: 'Named arguments may break',
          severity: 'medium',
          isBreaking: false,
        });
      }

      // Check optionality change
      if (oldParam.isOptional !== newParam.isOptional) {
        const changeType = newParam.isOptional ? 'parameter_made_optional' : 'parameter_made_required';
        changes.push({
          type: changeType,
          description: `Parameter '${newParam.name}' is now ${newParam.isOptional ? 'optional' : 'required'}`,
          impact: newParam.isOptional ? 'Non-breaking change' : 'Existing calls may break',
          severity: newParam.isOptional ? 'low' : 'high',
          isBreaking: !newParam.isOptional,
        });
      }
    }

    // Check return type change
    if (oldFn.returnType !== newFn.returnType) {
      changes.push({
        type: 'return_type_changed',
        description: `Return type changed from '${oldFn.returnType}' to '${newFn.returnType}'`,
        impact: 'Consumers may need to update type expectations',
        severity: 'high',
        isBreaking: true,
      });
    }

    // Check async modifier change
    if (oldFn.isAsync !== newFn.isAsync) {
      changes.push({
        type: newFn.isAsync ? 'made_async' : 'made_sync',
        description: `Function ${newFn.isAsync ? 'is now async' : 'is no longer async'}`,
        impact: 'Callers need to update await usage',
        severity: 'critical',
        isBreaking: true,
      });
    }

    return changes;
  }

  /**
   * Calculate drift score based on detected changes
   */
  private calculateDriftScore(changes: SemanticChange[]): number {
    let score = 0;

    for (const change of changes) {
      switch (change.severity) {
        case 'critical':
          score += 4;
          break;
        case 'high':
          score += 3;
          break;
        case 'medium':
          score += 2;
          break;
        case 'low':
          score += 1;
          break;
      }

      if (change.isBreaking) {
        score += 2;
      }
    }

    return Math.min(score, 10);
  }

  /**
   * Generate recommendation based on detected changes
   */
  private generateRecommendation(changes: SemanticChange[]): string {
    const hasBreaking = changes.some(c => c.isBreaking);
    const hasCritical = changes.some(c => c.severity === 'critical');

    if (hasBreaking && hasCritical) {
      return 'URGENT: Update documentation immediately - breaking changes detected that affect API compatibility';
    } else if (hasBreaking) {
      return 'Update documentation to reflect breaking changes in function signature';
    } else if (hasCritical) {
      return 'Update documentation to reflect critical changes in function behavior';
    } else {
      return 'Update documentation to reflect signature changes';
    }
  }

  /**
   * Reconstruct function code from FunctionInfo for display/analysis
   */
  private reconstructFunctionCode(fn: FunctionInfo): string {
    const asyncMod = fn.isAsync ? 'async ' : '';
    const exportMod = fn.isExported ? 'export ' : '';
    const params = fn.params.map(p => {
      const optional = p.isOptional ? '?' : '';
      return `${p.name}${optional}: ${p.type}`;
    }).join(', ');

    return `${exportMod}${asyncMod}function ${fn.name}(${params}): ${fn.returnType}`;
  }
}
