import { access } from 'node:fs/promises';
import path from 'node:path';
import type {
  MarkdownScanResult,
  LinkValidationFileReport,
  LinkInfo,
} from '../../types/index.js';

export class LinkValidator {
  constructor(private workingDirectory: string) {}

  async validateLinks(results: MarkdownScanResult[]): Promise<LinkValidationFileReport[]> {
    const reports: LinkValidationFileReport[] = [];

    for (const result of results) {
      const report = await this.validateFileLinks(result, results);
      reports.push(report);
    }

    return reports;
  }

  private async validateFileLinks(
    result: MarkdownScanResult,
    allResults: MarkdownScanResult[],
  ): Promise<LinkValidationFileReport> {
    const brokenLinks: Array<{ link: string; reason: string; lineNumber: number }> = [];
    const validLinks: string[] = [];
    const warnings: string[] = [];

    // Only validate internal links as per user requirement
    const internalLinks = result.links.filter((link) => link.isInternal);

    for (const link of internalLinks) {
      const validation = await this.validateInternalLink(link, result.file, allResults);

      if (validation.isValid) {
        validLinks.push(link.url);
      } else {
        brokenLinks.push({
          link: link.url,
          reason: validation.reason,
          lineNumber: link.line,
        });
      }
    }

    // Check for duplicate links
    const linkCounts = new Map<string, number>();
    for (const link of result.links) {
      const count = linkCounts.get(link.url) || 0;
      linkCounts.set(link.url, count + 1);
    }

    for (const [url, count] of linkCounts) {
      if (count > 3) {
        warnings.push(`Link "${url}" appears ${count} times - consider using a reference-style link`);
      }
    }

    return {
      file: result.file,
      totalLinks: result.links.length,
      internalLinks: internalLinks.length,
      externalLinks: result.links.filter((link) => !link.isInternal).length,
      brokenLinks,
      validLinks,
      warnings,
    };
  }

  private async validateInternalLink(
    link: LinkInfo,
    sourceFile: string,
    allResults: MarkdownScanResult[],
  ): Promise<{ isValid: boolean; reason: string }> {
    const url = link.url;

    // Handle anchor-only links (e.g., #section)
    if (url.startsWith('#')) {
      return this.validateAnchorLink(url, sourceFile, allResults);
    }

    // Parse the URL to separate file path and anchor
    const [filePath, anchor] = url.split('#');

    // Resolve the file path relative to the source file
    const sourceDir = path.dirname(sourceFile);
    let targetPath: string;

    if (filePath.startsWith('/')) {
      // Absolute path from project root
      targetPath = path.join(this.workingDirectory, filePath.slice(1));
    } else {
      // Relative path
      targetPath = path.resolve(sourceDir, filePath);
    }

    // Check if the file exists
    try {
      await access(targetPath);
    } catch {
      return {
        isValid: false,
        reason: `File not found: ${filePath}`,
      };
    }

    // If there's an anchor, validate it exists in the target file
    if (anchor) {
      const anchorValidation = await this.validateAnchorInFile(anchor, targetPath, allResults);
      if (!anchorValidation.isValid) {
        return {
          isValid: false,
          reason: `Anchor #${anchor} not found in ${filePath}`,
        };
      }
    }

    return { isValid: true, reason: '' };
  }

  private validateAnchorLink(
    anchor: string,
    sourceFile: string,
    allResults: MarkdownScanResult[],
  ): { isValid: boolean; reason: string } {
    // Find the scan result for this file
    const result = allResults.find((r) => r.file === sourceFile);

    if (!result) {
      return { isValid: false, reason: 'Source file not in scan results' };
    }

    // Extract anchor name (remove # prefix)
    const anchorName = anchor.slice(1);

    // Check if any section matches this anchor
    // Markdown generates anchors from headings by lowercasing and replacing spaces with dashes
    const sectionAnchors = result.sections.map((s) => this.generateAnchor(s.title));

    if (!sectionAnchors.includes(anchorName)) {
      return {
        isValid: false,
        reason: `Anchor ${anchor} not found in document`,
      };
    }

    return { isValid: true, reason: '' };
  }

  private async validateAnchorInFile(
    anchor: string,
    targetPath: string,
    allResults: MarkdownScanResult[],
  ): Promise<{ isValid: boolean; reason: string }> {
    // Find the scan result for the target file
    const result = allResults.find((r) => r.file === targetPath);

    if (!result) {
      // File exists but wasn't scanned - assume valid
      return { isValid: true, reason: '' };
    }

    // Check if any section matches this anchor
    const sectionAnchors = result.sections.map((s) => this.generateAnchor(s.title));

    if (!sectionAnchors.includes(anchor)) {
      return {
        isValid: false,
        reason: `Anchor not found`,
      };
    }

    return { isValid: true, reason: '' };
  }

  /**
   * Generate an anchor ID from a heading title
   * Follows GitHub Flavored Markdown rules:
   * - Convert to lowercase
   * - Replace spaces with hyphens
   * - Remove special characters
   */
  private generateAnchor(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }
}
