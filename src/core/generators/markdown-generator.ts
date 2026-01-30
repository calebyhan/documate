import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { CodeScanResult, DocuMateConfig } from '../../types/index.js';

export interface MarkdownGenerationSuggestion {
  type: 'api-reference' | 'architecture' | 'usage-guide';
  filePath: string;
  content: string;
  reason: string;
}

export class MarkdownGenerator {
  constructor(private config: DocuMateConfig) {}

  /**
   * Generate markdown documentation suggestions from code
   * Returns suggestions that require user confirmation before writing
   */
  generateSuggestions(codeResults: CodeScanResult[]): MarkdownGenerationSuggestion[] {
    const suggestions: MarkdownGenerationSuggestion[] = [];

    // Group code by directory to suggest architecture docs
    const dirGroups = this.groupByDirectory(codeResults);

    for (const [dir, files] of dirGroups) {
      if (files.length > 3) {
        // Suggest architecture doc for directories with multiple files
        const archDoc = this.generateArchitectureDocForDirectory(dir, files);
        suggestions.push({
          type: 'architecture',
          filePath: path.join(this.config.markdown?.docsDirectory || 'docs', dir, 'ARCHITECTURE.md'),
          content: archDoc,
          reason: `Directory "${dir}" has ${files.length} files without architecture documentation`,
        });
      }
    }

    // Generate API reference for public APIs
    const publicAPIs = this.extractPublicAPIs(codeResults);
    if (publicAPIs.length > 0) {
      const apiDoc = this.generateAPIReference(publicAPIs);
      suggestions.push({
        type: 'api-reference',
        filePath: path.join(this.config.markdown?.docsDirectory || 'docs', 'API.md'),
        content: apiDoc,
        reason: `Found ${publicAPIs.length} public APIs without documentation`,
      });
    }

    // Generate usage guide if there are CLI commands or main entry points
    const entryPoints = this.findEntryPoints(codeResults);
    if (entryPoints.length > 0) {
      const usageDoc = this.generateUsageGuide(entryPoints);
      suggestions.push({
        type: 'usage-guide',
        filePath: path.join(this.config.markdown?.docsDirectory || 'docs', 'USAGE.md'),
        content: usageDoc,
        reason: `Found ${entryPoints.length} entry points that could use usage documentation`,
      });
    }

    return suggestions;
  }

  /**
   * Write a markdown file after user confirmation
   */
  async writeMarkdown(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await mkdir(dir, { recursive: true });

    // Write the file
    await writeFile(filePath, content, 'utf-8');
  }

  private groupByDirectory(codeResults: CodeScanResult[]): Map<string, CodeScanResult[]> {
    const groups = new Map<string, CodeScanResult[]>();

    for (const result of codeResults) {
      const dir = path.dirname(result.file).split('/')[0] || '.';

      if (!groups.has(dir)) {
        groups.set(dir, []);
      }
      groups.get(dir)!.push(result);
    }

    return groups;
  }

  private extractPublicAPIs(codeResults: CodeScanResult[]): Array<{
    name: string;
    type: 'function' | 'class';
    file: string;
    documentation?: string;
  }> {
    const apis: Array<{
      name: string;
      type: 'function' | 'class';
      file: string;
      documentation?: string;
    }> = [];

    for (const result of codeResults) {
      // Exported functions (assuming they don't start with underscore)
      for (const func of result.functions) {
        if (!func.name.startsWith('_') && func.hasDocumentation) {
          apis.push({
            name: func.name,
            type: 'function',
            file: result.file,
            documentation: func.documentation,
          });
        }
      }

      // Exported classes
      for (const cls of result.classes) {
        if (!cls.name.startsWith('_')) {
          apis.push({
            name: cls.name,
            type: 'class',
            file: result.file,
            documentation: cls.documentation,
          });
        }
      }
    }

    return apis;
  }

  private findEntryPoints(codeResults: CodeScanResult[]): CodeScanResult[] {
    return codeResults.filter((result) => {
      const fileName = path.basename(result.file).toLowerCase();
      return (
        fileName === 'index.ts' ||
        fileName === 'main.ts' ||
        fileName === 'cli.ts' ||
        fileName === 'app.ts' ||
        result.file.includes('/commands/')
      );
    });
  }

  /**
   * Generate architecture documentation for a set of code files
   */
  public generateArchitectureDoc(codeResults: CodeScanResult[]): string {
    const dirGroups = this.groupByDirectory(codeResults);
    let content = `# Architecture Overview\n\n`;
    content += `This document describes the project architecture.\n\n`;

    for (const [directory, files] of dirGroups) {
      content += `## ${directory}\n\n`;
      content += `The \`${directory}\` module contains ${files.length} files:\n\n`;

      for (const file of files) {
        const fileName = path.basename(file.file);
        const classCount = file.classes.length;
        const functionCount = file.functions.length;

        content += `- **${fileName}**: ${classCount} class(es), ${functionCount} function(s)\n`;
      }

      content += `\n### Components\n\n`;

      // Document each class
      for (const file of files) {
        for (const cls of file.classes) {
          content += `#### ${cls.name}\n\n`;

          if (cls.documentation) {
            content += `${cls.documentation}\n\n`;
          }

          if (cls.methods.length > 0) {
            content += `**Methods:**\n\n`;
            for (const method of cls.methods) {
              const paramNames = method.params.map((p) => p.name).join(', ');
              content += `- \`${method.name}(${paramNames})\``;
              if (method.documentation) {
                content += ` - ${method.documentation.split('\n')[0]}`;
              }
              content += '\n';
            }
            content += '\n';
          }
        }
      }

      content += `### File Structure\n\n`;
      content += '```\n';
      content += `${directory}/\n`;
      for (const file of files) {
        content += `  ${path.basename(file.file)}\n`;
      }
      content += '```\n\n';
    }

    return content;
  }

  private generateArchitectureDocForDirectory(directory: string, files: CodeScanResult[]): string {
    let content = `# ${directory} Architecture\n\n`;
    content += `This document describes the architecture of the \`${directory}\` module.\n\n`;

    content += `## Overview\n\n`;
    content += `The \`${directory}\` module contains ${files.length} files:\n\n`;

    for (const file of files) {
      const fileName = path.basename(file.file);
      const classCount = file.classes.length;
      const functionCount = file.functions.length;

      content += `- **${fileName}**: ${classCount} class(es), ${functionCount} function(s)\n`;
    }

    content += `\n## Components\n\n`;

    // Document each class
    for (const file of files) {
      for (const cls of file.classes) {
        content += `### ${cls.name}\n\n`;

        if (cls.documentation) {
          content += `${cls.documentation}\n\n`;
        }

        if (cls.methods.length > 0) {
          content += `**Methods:**\n\n`;
          for (const method of cls.methods) {
            const paramNames = method.params.map((p) => p.name).join(', ');
            content += `- \`${method.name}(${paramNames})\``;
            if (method.documentation) {
              content += ` - ${method.documentation.split('\n')[0]}`;
            }
            content += '\n';
          }
          content += '\n';
        }
      }
    }

    content += `## File Structure\n\n`;
    content += '```\n';
    content += `${directory}/\n`;
    for (const file of files) {
      content += `  ${path.basename(file.file)}\n`;
    }
    content += '```\n';

    return content;
  }

  /**
   * Generate API reference documentation from code results
   */
  public generateAPIReferenceDoc(codeResults: CodeScanResult[]): string {
    const apis = this.extractPublicAPIs(codeResults);
    return this.generateAPIReference(apis);
  }

  private generateAPIReference(
    apis: Array<{ name: string; type: 'function' | 'class'; file: string; documentation?: string }>,
  ): string {
    let content = `# API Reference\n\n`;
    content += `This document provides a reference for all public APIs.\n\n`;

    // Group by type
    const functions = apis.filter((api) => api.type === 'function');
    const classes = apis.filter((api) => api.type === 'class');

    if (functions.length > 0) {
      content += `## Functions\n\n`;

      for (const func of functions) {
        content += `### \`${func.name}()\`\n\n`;

        if (func.documentation) {
          content += `${func.documentation}\n\n`;
        }

        content += `**Source:** \`${func.file}\`\n\n`;
      }
    }

    if (classes.length > 0) {
      content += `## Classes\n\n`;

      for (const cls of classes) {
        content += `### \`${cls.name}\`\n\n`;

        if (cls.documentation) {
          content += `${cls.documentation}\n\n`;
        }

        content += `**Source:** \`${cls.file}\`\n\n`;
      }
    }

    return content;
  }

  private generateUsageGuide(entryPoints: CodeScanResult[]): string {
    let content = `# Usage Guide\n\n`;
    content += `This guide shows how to use the main features of this project.\n\n`;

    content += `## Getting Started\n\n`;
    content += `\`\`\`bash\n`;
    content += `# Install dependencies\n`;
    content += `npm install\n\n`;
    content += `# Build the project\n`;
    content += `npm run build\n`;
    content += `\`\`\`\n\n`;

    content += `## Available Commands\n\n`;

    for (const entry of entryPoints) {
      const fileName = path.basename(entry.file, path.extname(entry.file));

      if (entry.functions.length > 0) {
        content += `### ${fileName}\n\n`;

        for (const func of entry.functions) {
          if (!func.name.startsWith('_')) {
            content += `#### \`${func.name}()\`\n\n`;

            if (func.documentation) {
              content += `${func.documentation}\n\n`;
            }

            const paramNames = func.params.map((p) => p.name).join(', ');
            content += `\`\`\`typescript\n`;
            content += `${func.name}(${paramNames})\n`;
            content += `\`\`\`\n\n`;
          }
        }
      }
    }

    content += `## Examples\n\n`;
    content += `\`\`\`typescript\n`;
    content += `// TODO: Add usage examples\n`;
    content += `\`\`\`\n`;

    return content;
  }
}
