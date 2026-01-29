import type { FunctionInfo } from '../../types/index.js';
import type { CopilotWrapper } from '../../copilot/wrapper.js';
import { generateDocPrompt } from '../../copilot/prompts.js';
import { extractCodeBlockFromResponse } from '../../copilot/parsers.js';

export class DocGenerator {
  constructor(private copilot?: CopilotWrapper) {}

  async generateForFunction(fn: FunctionInfo, code: string, style: string = 'jsdoc'): Promise<string> {
    if (this.copilot) {
      try {
        const response = await this.copilot.explain(generateDocPrompt(code, style));
        if (response.success) {
          const extracted = extractCodeBlockFromResponse(response.raw);
          if (extracted && extracted.includes('/**')) return extracted;
          // Try to find JSDoc directly in raw
          const jsdocMatch = response.raw.match(/(\/\*\*[\s\S]*?\*\/)/);
          if (jsdocMatch) return jsdocMatch[1];
        }
      } catch {
        // Fall through to template
      }
    }

    return this.generateTemplate(fn, style);
  }

  generateTemplate(fn: FunctionInfo, _style: string = 'jsdoc'): string {
    const lines: string[] = ['/**'];
    lines.push(` * ${fn.name} - TODO: Add description`);
    lines.push(' *');

    for (const param of fn.params) {
      const optional = param.isOptional ? ' (optional)' : '';
      lines.push(` * @param {${param.type}} ${param.name} - TODO: Describe${optional}`);
    }

    if (fn.returnType !== 'void' && fn.returnType !== 'unknown') {
      lines.push(` * @returns {${fn.returnType}} TODO: Describe return value`);
    }

    lines.push(' */');
    return lines.join('\n');
  }
}
