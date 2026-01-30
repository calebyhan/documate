import { readFile } from 'node:fs/promises';
import type { BaseScanner } from './base-scanner.js';
import type { CodeScanResult, FunctionInfo, ClassInfo } from '../../types/index.js';

/**
 * Scanner for Python files using regex-based parsing
 * Note: This is a simplified implementation and may not handle all Python syntax edge cases
 */
export class PythonScanner implements BaseScanner {
  supports(filePath: string): boolean {
    return /\.py$/i.test(filePath);
  }

  async scanFile(filePath: string): Promise<CodeScanResult> {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const functions: FunctionInfo[] = [];
    const classes: ClassInfo[] = [];

    let currentClass: ClassInfo | null = null;
    let currentIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (trimmed.startsWith('#') || trimmed.length === 0) continue;

      // Match class definition
      const classMatch = trimmed.match(/^class\s+(\w+)/);
      if (classMatch) {
        if (currentClass) {
          classes.push(currentClass);
        }
        currentClass = this.extractClassFromLines(lines, i, classMatch[1], filePath);
        currentIndent = line.match(/^(\s*)/)?.[1].length || 0;
        continue;
      }

      // Match function/method definition
      const funcMatch = trimmed.match(/^(async\s+)?def\s+(\w+)\s*\((.*?)\)/);
      if (funcMatch) {
        const indent = line.match(/^(\s*)/)?.[1].length || 0;

        // If inside a class and indent is deeper, it's a method
        if (currentClass && indent > currentIndent) {
          const method = this.extractFunctionFromLines(lines, i, funcMatch[2], funcMatch[3], filePath, funcMatch[1] !== undefined);
          method.type = 'method';
          currentClass.methods.push(method);
        } else {
          // It's a module-level function
          if (currentClass && indent <= currentIndent) {
            classes.push(currentClass);
            currentClass = null;
          }
          const func = this.extractFunctionFromLines(lines, i, funcMatch[2], funcMatch[3], filePath, funcMatch[1] !== undefined);
          functions.push(func);
        }
      }
    }

    // Don't forget the last class
    if (currentClass) {
      classes.push(currentClass);
    }

    return {
      file: filePath,
      language: 'python',
      functions,
      classes,
    };
  }

  private extractClassFromLines(
    lines: string[],
    startLine: number,
    className: string,
    filePath: string,
  ): ClassInfo {
    const docstring = this.extractDocstringFromLines(lines, startLine + 1);
    const hasDocumentation = !!docstring;

    // Find the end of the class
    const classIndent = lines[startLine].match(/^(\s*)/)?.[1].length || 0;
    let endLine = startLine + 1;
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0 || line.startsWith('#')) continue;

      const lineIndent = lines[i].match(/^(\s*)/)?.[1].length || 0;
      if (lineIndent <= classIndent && line.length > 0) {
        endLine = i - 1;
        break;
      }
      endLine = i;
    }

    return {
      name: className,
      methods: [],
      properties: [],
      hasDocumentation,
      documentation: docstring,
      isExported: !className.startsWith('_'),
      location: {
        file: filePath,
        startLine: startLine + 1,
        endLine: endLine + 1,
      },
    };
  }

  private extractFunctionFromLines(
    lines: string[],
    startLine: number,
    funcName: string,
    paramsStr: string,
    filePath: string,
    isAsync: boolean,
  ): FunctionInfo {
    const docstring = this.extractDocstringFromLines(lines, startLine + 1);
    const hasDocumentation = !!docstring;
    const params = this.parseParameters(paramsStr);

    // Find the end of the function
    const funcIndent = lines[startLine].match(/^(\s*)/)?.[1].length || 0;
    let endLine = startLine + 1;
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0 || line.startsWith('#')) continue;

      const lineIndent = lines[i].match(/^(\s*)/)?.[1].length || 0;
      if (lineIndent <= funcIndent && line.length > 0) {
        endLine = i - 1;
        break;
      }
      endLine = i;
    }

    return {
      name: funcName,
      type: 'function',
      params,
      returnType: 'Any',
      hasDocumentation,
      documentation: docstring,
      isExported: !funcName.startsWith('_'),
      isAsync,
      visibility: funcName.startsWith('_') ? 'private' : 'public',
      location: {
        file: filePath,
        startLine: startLine + 1,
        endLine: endLine + 1,
      },
      complexity: {
        linesOfCode: endLine - startLine,
        cyclomaticComplexity: 1,
      },
    };
  }

  private extractDocstringFromLines(lines: string[], startIndex: number): string | undefined {
    if (startIndex >= lines.length) return undefined;

    const firstLine = lines[startIndex].trim();

    // Check for triple-quoted strings
    if (firstLine.startsWith('"""') || firstLine.startsWith("'''")) {
      const quote = firstLine.substring(0, 3);
      let docstring = firstLine.substring(3);

      // Check if docstring ends on the same line
      if (docstring.endsWith(quote)) {
        return docstring.substring(0, docstring.length - 3).trim();
      }

      // Multi-line docstring
      for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(quote)) {
          docstring += '\n' + line.substring(0, line.indexOf(quote));
          return docstring.trim();
        }
        docstring += '\n' + line;
      }
    }

    return undefined;
  }

  private parseParameters(paramsStr: string): Array<{
    name: string;
    type: string;
    isOptional: boolean;
    defaultValue?: string;
  }> {
    const params: Array<{
      name: string;
      type: string;
      isOptional: boolean;
      defaultValue?: string;
    }> = [];

    if (!paramsStr.trim()) return params;

    const paramList = paramsStr.split(',').map((p) => p.trim());

    for (const param of paramList) {
      if (param === 'self' || param === 'cls') continue; // Skip self/cls parameter

      // Parse param with type hint: name: type = default
      const match = param.match(/^(\w+)(?::\s*([^=]+))?(?:\s*=\s*(.+))?$/);
      if (match) {
        params.push({
          name: match[1],
          type: match[2]?.trim() || 'Any',
          isOptional: !!match[3],
          defaultValue: match[3]?.trim(),
        });
      }
    }

    return params;
  }
}
