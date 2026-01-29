import ts from 'typescript';
import { readFile } from 'node:fs/promises';
import type { BaseScanner } from './base-scanner.js';
import type { ScanResult, FunctionInfo, ClassInfo, ParameterInfo, PropertyInfo } from '../../types/index.js';

export class TypeScriptScanner implements BaseScanner {
  supports(filePath: string): boolean {
    return /\.(ts|tsx|js|jsx)$/.test(filePath);
  }

  async scanFile(filePath: string): Promise<ScanResult> {
    const content = await readFile(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
    );

    const functions: FunctionInfo[] = [];
    const classes: ClassInfo[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        functions.push(this.extractFunctionInfo(node, sourceFile, filePath));
      } else if (ts.isClassDeclaration(node) && node.name) {
        classes.push(this.extractClassInfo(node, sourceFile, filePath));
      } else if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (
            ts.isVariableDeclaration(decl) &&
            decl.name &&
            ts.isIdentifier(decl.name) &&
            decl.initializer &&
            (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
          ) {
            functions.push(
              this.extractArrowFunctionInfo(decl, decl.initializer, node, sourceFile, filePath),
            );
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);

    const lang = /\.tsx?$/.test(filePath) ? 'typescript' : 'javascript';

    return { file: filePath, language: lang, functions, classes };
  }

  private extractFunctionInfo(
    node: ts.FunctionDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string,
  ): FunctionInfo {
    const name = node.name?.getText(sourceFile) ?? 'anonymous';
    const params = this.extractParameters(node.parameters, sourceFile);
    const returnType = node.type?.getText(sourceFile) ?? 'unknown';
    const docs = this.extractJSDoc(node, sourceFile);
    const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const isExported = this.hasModifier(node, ts.SyntaxKind.ExportKeyword);
    const isAsync = this.hasModifier(node, ts.SyntaxKind.AsyncKeyword);

    return {
      name,
      type: 'function',
      params,
      returnType,
      hasDocumentation: docs !== null,
      documentation: docs ?? undefined,
      isExported,
      isAsync,
      visibility: isExported ? 'public' : 'internal',
      location: { file: filePath, startLine: startLine + 1, endLine: endLine + 1 },
      complexity: {
        linesOfCode: endLine - startLine + 1,
        cyclomaticComplexity: this.calculateCyclomaticComplexity(node),
      },
    };
  }

  private extractArrowFunctionInfo(
    decl: ts.VariableDeclaration,
    fn: ts.ArrowFunction | ts.FunctionExpression,
    statement: ts.VariableStatement,
    sourceFile: ts.SourceFile,
    filePath: string,
  ): FunctionInfo {
    const name = (decl.name as ts.Identifier).text;
    const params = this.extractParameters(fn.parameters, sourceFile);
    const returnType = fn.type?.getText(sourceFile) ?? 'unknown';
    const docs = this.extractJSDoc(statement, sourceFile);
    const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
    const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(statement.getEnd());
    const isExported = this.hasModifier(statement, ts.SyntaxKind.ExportKeyword);
    const isAsync = this.hasModifier(fn, ts.SyntaxKind.AsyncKeyword);

    return {
      name,
      type: 'arrow',
      params,
      returnType,
      hasDocumentation: docs !== null,
      documentation: docs ?? undefined,
      isExported,
      isAsync,
      visibility: isExported ? 'public' : 'internal',
      location: { file: filePath, startLine: startLine + 1, endLine: endLine + 1 },
      complexity: {
        linesOfCode: endLine - startLine + 1,
        cyclomaticComplexity: this.calculateCyclomaticComplexity(fn),
      },
    };
  }

  private extractClassInfo(
    node: ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string,
  ): ClassInfo {
    const name = node.name?.getText(sourceFile) ?? 'anonymous';
    const docs = this.extractJSDoc(node, sourceFile);
    const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const isExported = this.hasModifier(node, ts.SyntaxKind.ExportKeyword);

    const methods: FunctionInfo[] = [];
    const properties: PropertyInfo[] = [];

    for (const member of node.members) {
      if (ts.isMethodDeclaration(member) && member.name) {
        methods.push(this.extractMethodInfo(member, sourceFile, filePath));
      } else if (ts.isPropertyDeclaration(member) && member.name) {
        properties.push(this.extractPropertyInfo(member, sourceFile));
      }
    }

    return {
      name,
      methods,
      properties,
      hasDocumentation: docs !== null,
      documentation: docs ?? undefined,
      isExported,
      location: { file: filePath, startLine: startLine + 1, endLine: endLine + 1 },
    };
  }

  private extractMethodInfo(
    node: ts.MethodDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string,
  ): FunctionInfo {
    const name = node.name.getText(sourceFile);
    const params = this.extractParameters(node.parameters, sourceFile);
    const returnType = node.type?.getText(sourceFile) ?? 'unknown';
    const docs = this.extractJSDoc(node, sourceFile);
    const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const isAsync = this.hasModifier(node, ts.SyntaxKind.AsyncKeyword);
    const visibility = this.getVisibility(node);

    return {
      name,
      type: 'method',
      params,
      returnType,
      hasDocumentation: docs !== null,
      documentation: docs ?? undefined,
      isExported: false,
      isAsync,
      visibility,
      location: { file: filePath, startLine: startLine + 1, endLine: endLine + 1 },
      complexity: {
        linesOfCode: endLine - startLine + 1,
        cyclomaticComplexity: this.calculateCyclomaticComplexity(node),
      },
    };
  }

  private extractPropertyInfo(node: ts.PropertyDeclaration, sourceFile: ts.SourceFile): PropertyInfo {
    const name = node.name.getText(sourceFile);
    const type = node.type?.getText(sourceFile) ?? 'unknown';
    const docs = this.extractJSDoc(node, sourceFile);
    const visibility = this.getVisibility(node);

    return {
      name,
      type,
      visibility: visibility === 'internal' ? 'public' : visibility as 'public' | 'private' | 'protected',
      hasDocumentation: docs !== null,
    };
  }

  private extractParameters(
    params: ts.NodeArray<ts.ParameterDeclaration>,
    sourceFile: ts.SourceFile,
  ): ParameterInfo[] {
    return params.map((param) => ({
      name: param.name.getText(sourceFile),
      type: param.type?.getText(sourceFile) ?? 'unknown',
      isOptional: !!param.questionToken || !!param.initializer,
      defaultValue: param.initializer?.getText(sourceFile),
    }));
  }

  private extractJSDoc(node: ts.Node, sourceFile: ts.SourceFile): string | null {
    const text = sourceFile.getFullText();
    const commentRanges = ts.getLeadingCommentRanges(text, node.getFullStart());
    if (!commentRanges) return null;

    for (const range of commentRanges) {
      const comment = text.substring(range.pos, range.end);
      if (comment.startsWith('/**')) {
        return comment;
      }
    }

    return null;
  }

  private hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    return modifiers?.some((m) => m.kind === kind) ?? false;
  }

  private getVisibility(node: ts.Node): 'public' | 'private' | 'protected' | 'internal' {
    if (this.hasModifier(node, ts.SyntaxKind.PrivateKeyword)) return 'private';
    if (this.hasModifier(node, ts.SyntaxKind.ProtectedKeyword)) return 'protected';
    if (this.hasModifier(node, ts.SyntaxKind.PublicKeyword)) return 'public';
    return 'internal';
  }

  private calculateCyclomaticComplexity(node: ts.Node): number {
    let complexity = 1;

    const visit = (child: ts.Node) => {
      switch (child.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.ConditionalExpression:
          complexity++;
          break;
        case ts.SyntaxKind.BinaryExpression: {
          const binExpr = child as ts.BinaryExpression;
          if (
            binExpr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
            binExpr.operatorToken.kind === ts.SyntaxKind.BarBarToken
          ) {
            complexity++;
          }
          break;
        }
      }
      ts.forEachChild(child, visit);
    };

    ts.forEachChild(node, visit);
    return complexity;
  }
}
