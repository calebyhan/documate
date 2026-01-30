import { readFile } from 'node:fs/promises';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import { visit } from 'unist-util-visit';
import type { BaseScanner } from './base-scanner.js';
import type {
  MarkdownScanResult,
  SectionInfo,
  LinkInfo,
  CodeBlockInfo,
  CodeReferenceInfo,
} from '../../types/index.js';
import type { Root, Heading, Link, Code, InlineCode, Text, YAML } from 'mdast';

export class MarkdownScanner implements BaseScanner {
  supports(filePath: string): boolean {
    return /\.md$/i.test(filePath);
  }

  async scanFile(filePath: string): Promise<MarkdownScanResult> {
    const content = await readFile(filePath, 'utf-8');
    const tree = remark()
      .use(remarkGfm)
      .use(remarkFrontmatter, ['yaml'])
      .parse(content);

    const sections: SectionInfo[] = [];
    const links: LinkInfo[] = [];
    const codeBlocks: CodeBlockInfo[] = [];
    const codeReferences: CodeReferenceInfo[] = [];
    let metadata: Record<string, string> | undefined;

    // Track heading hierarchy for section nesting
    const headingStack: Array<{ level: number; section: SectionInfo }> = [];

    visit(tree, (node, index, parent) => {
      // Extract headings and build section hierarchy
      if (node.type === 'heading') {
        const heading = node as Heading;
        const title = this.extractTextFromNode(heading);
        const section: SectionInfo = {
          level: heading.depth,
          title,
          content: '',
          line: (heading.position?.start.line ?? 0),
          subsections: [],
        };

        // Pop from stack until we find a parent with lower level
        while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= heading.depth) {
          headingStack.pop();
        }

        // Add to parent or root
        if (headingStack.length > 0) {
          headingStack[headingStack.length - 1].section.subsections.push(section);
        } else {
          sections.push(section);
        }

        headingStack.push({ level: heading.depth, section });
      }

      // Extract links
      if (node.type === 'link') {
        const link = node as Link;
        const isInternal = this.isInternalLink(link.url);
        links.push({
          text: this.extractTextFromNode(link),
          url: link.url,
          line: link.position?.start.line ?? 0,
          isInternal,
        });
      }

      // Extract code blocks
      if (node.type === 'code') {
        const code = node as Code;
        codeBlocks.push({
          language: code.lang ?? 'text',
          code: code.value,
          line: code.position?.start.line ?? 0,
        });
      }

      // Extract code references from inline code
      if (node.type === 'inlineCode') {
        const inlineCode = node as InlineCode;
        const ref = this.parseCodeReference(inlineCode.value, inlineCode.position?.start.line ?? 0);
        if (ref) {
          codeReferences.push(ref);
        }
      }

      // Extract code references from text (identify identifiers in prose)
      if (node.type === 'text') {
        const text = node as Text;
        const refs = this.extractCodeReferencesFromText(text.value, text.position?.start.line ?? 0);
        codeReferences.push(...refs);
      }

      // Extract frontmatter
      if (node.type === 'yaml') {
        const yaml = node as YAML;
        metadata = this.parseFrontmatter(yaml.value);
      }
    });

    return {
      file: filePath,
      language: 'markdown',
      sections,
      links,
      codeBlocks,
      codeReferences,
      metadata,
    };
  }

  /**
   * Extract plain text from a markdown node (recursively)
   */
  private extractTextFromNode(node: any): string {
    if (node.type === 'text') {
      return node.value;
    }
    if (node.type === 'inlineCode') {
      return node.value;
    }
    if (node.children) {
      return node.children.map((child: any) => this.extractTextFromNode(child)).join('');
    }
    return '';
  }

  /**
   * Determine if a link is internal (local file or anchor)
   */
  private isInternalLink(url: string): boolean {
    // Internal links: relative paths, anchors, or local files
    if (url.startsWith('#')) return true;
    if (url.startsWith('/')) return true;
    if (url.startsWith('./') || url.startsWith('../')) return true;
    if (!url.includes('://') && !url.startsWith('mailto:')) return true;
    return false;
  }

  /**
   * Parse code reference from inline code (e.g., `functionName()`, `ClassName`)
   */
  private parseCodeReference(code: string, line: number): CodeReferenceInfo | null {
    // Function call: identifier()
    const functionMatch = code.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\(\)$/);
    if (functionMatch) {
      return {
        type: 'function',
        name: functionMatch[1],
        line,
        context: code,
      };
    }

    // Method call: Class.method()
    const methodMatch = code.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\.([a-zA-Z_$][a-zA-Z0-9_$]*)\(\)$/);
    if (methodMatch) {
      return {
        type: 'method',
        name: `${methodMatch[1]}.${methodMatch[2]}`,
        line,
        context: code,
      };
    }

    // Class/Type (PascalCase identifier)
    const classMatch = code.match(/^([A-Z][a-zA-Z0-9_$]*)$/);
    if (classMatch) {
      return {
        type: 'class',
        name: classMatch[1],
        line,
        context: code,
      };
    }

    // Type reference: identifier (could be function, class, or type)
    const identifierMatch = code.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
    if (identifierMatch) {
      return {
        type: 'type',
        name: identifierMatch[1],
        line,
        context: code,
      };
    }

    return null;
  }

  /**
   * Extract code references from prose text (identify camelCase/PascalCase identifiers)
   */
  private extractCodeReferencesFromText(text: string, line: number): CodeReferenceInfo[] {
    const references: CodeReferenceInfo[] = [];

    // Match identifiers that look like code (camelCase or PascalCase, not in quotes)
    // Exclude common English words
    const codePattern = /\b([A-Z][a-zA-Z0-9]*|[a-z]+[A-Z][a-zA-Z0-9]*)\b/g;
    const excludeWords = new Set([
      'JavaScript', 'TypeScript', 'Python', 'API', 'HTML', 'CSS',
      'JSON', 'XML', 'HTTP', 'HTTPS', 'URL', 'CLI', 'SDK',
    ]);

    let match;
    while ((match = codePattern.exec(text)) !== null) {
      const name = match[1];

      // Skip common technical terms
      if (excludeWords.has(name)) continue;

      // Skip if it's all caps (likely acronym)
      if (name === name.toUpperCase()) continue;

      // Classify based on capitalization
      const type = name[0] === name[0].toUpperCase() ? 'class' : 'function';

      references.push({
        type,
        name,
        line,
        context: text.substring(Math.max(0, match.index - 20), Math.min(text.length, match.index + name.length + 20)),
      });
    }

    return references;
  }

  /**
   * Parse YAML frontmatter into key-value pairs
   */
  private parseFrontmatter(yaml: string): Record<string, string> {
    const metadata: Record<string, string> = {};

    const lines = yaml.split('\n');
    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
      if (match) {
        metadata[match[1]] = match[2].trim();
      }
    }

    return metadata;
  }
}
