import type {
  MarkdownScanResult,
  MarkdownFileHealthReport,
  DocuMateConfig,
} from '../../types/index.js';

export class MarkdownHealthCalculator {
  constructor(private config: DocuMateConfig) {}

  calculateHealth(results: MarkdownScanResult[]): MarkdownFileHealthReport[] {
    const reports: MarkdownFileHealthReport[] = [];

    for (const result of results) {
      const report = this.analyzeFile(result);
      reports.push(report);
    }

    return reports;
  }

  private analyzeFile(result: MarkdownScanResult): MarkdownFileHealthReport {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check for expected sections (from config)
    const expectedSections = this.getExpectedSections(result.file);
    if (expectedSections.length > 0) {
      const missingSections = this.checkExpectedSections(result, expectedSections);
      if (missingSections.length > 0) {
        issues.push(`Missing expected sections: ${missingSections.join(', ')}`);
        score -= missingSections.length * 10;
      }
    }

    // Check section structure
    const structureIssues = this.checkSectionStructure(result);
    if (structureIssues.length > 0) {
      issues.push(...structureIssues);
      score -= structureIssues.length * 5;
    }

    // Check content completeness
    const completenessIssues = this.checkContentCompleteness(result);
    if (completenessIssues.length > 0) {
      suggestions.push(...completenessIssues);
      score -= completenessIssues.length * 3;
    }

    // Check for empty sections
    const emptySections = result.sections.filter((s) => !s.content || s.content.trim().length === 0);
    if (emptySections.length > 0) {
      issues.push(
        `${emptySections.length} empty section(s): ${emptySections.map((s) => s.title).join(', ')}`,
      );
      score -= emptySections.length * 8;
    }

    // Check for code examples in technical documentation
    if (this.isTechnicalDoc(result)) {
      if (result.codeBlocks.length === 0) {
        suggestions.push('Consider adding code examples to illustrate usage');
        score -= 5;
      }
    }

    // Check for broken structure (heading levels that skip)
    const levelJumps = this.checkHeadingLevelJumps(result);
    if (levelJumps.length > 0) {
      issues.push(...levelJumps);
      score -= levelJumps.length * 3;
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    return {
      file: result.file,
      score,
      issues,
      suggestions,
      expectedSections,
      missingSections: this.checkExpectedSections(result, expectedSections),
      emptySections: emptySections.map((s) => s.title),
      hasCodeExamples: result.codeBlocks.length > 0,
      sectionCount: result.sections.length,
    };
  }

  private getExpectedSections(filePath: string): string[] {
    if (!this.config.markdown?.expectedSections) {
      return [];
    }

    const fileName = filePath.split('/').pop() || '';
    const expected = this.config.markdown.expectedSections[fileName];

    if (expected && Array.isArray(expected)) {
      return expected;
    }

    // Check if it's a README
    if (fileName === 'README.md') {
      return this.config.markdown.expectedSections['README.md'] || [];
    }

    return [];
  }

  private checkExpectedSections(result: MarkdownScanResult, expectedSections: string[]): string[] {
    const actualSectionTitles = result.sections.map((s) => s.title.toLowerCase());
    const missing: string[] = [];

    for (const expected of expectedSections) {
      const expectedLower = expected.toLowerCase();
      if (!actualSectionTitles.includes(expectedLower)) {
        missing.push(expected);
      }
    }

    return missing;
  }

  private checkSectionStructure(result: MarkdownScanResult): string[] {
    const issues: string[] = [];

    // Check if document starts with a heading
    if (result.sections.length > 0 && result.sections[0].level !== 1) {
      issues.push('Document should start with a level 1 heading (# Title)');
    }

    // Check for multiple H1 headings (usually not recommended)
    const h1Count = result.sections.filter((s) => s.level === 1).length;
    if (h1Count > 1) {
      issues.push(`Found ${h1Count} level 1 headings - consider using only one main title`);
    } else if (h1Count === 0) {
      issues.push('Document is missing a level 1 heading (# Title)');
    }

    return issues;
  }

  private checkContentCompleteness(result: MarkdownScanResult): string[] {
    const suggestions: string[] = [];

    // Check for very short sections (likely incomplete)
    const shortSections = result.sections.filter(
      (s) => s.content && s.content.trim().length > 0 && s.content.trim().length < 50,
    );

    if (shortSections.length > 0) {
      suggestions.push(
        `${shortSections.length} section(s) with minimal content: ${shortSections.map((s) => s.title).join(', ')}`,
      );
    }

    // Check if there are sections with no links or code blocks (might need examples)
    const sectionsWithoutExamples = result.sections.filter((section) => {
      const sectionStart = section.line;
      const nextSection = result.sections.find((s) => s.line > sectionStart);
      const sectionEnd = nextSection ? nextSection.line : Infinity;

      const hasCodeInSection = result.codeBlocks.some(
        (cb) => cb.line >= sectionStart && cb.line < sectionEnd,
      );
      const hasLinksInSection = result.links.some(
        (link) => link.line >= sectionStart && link.line < sectionEnd,
      );

      return !hasCodeInSection && !hasLinksInSection && section.content.length > 100;
    });

    if (sectionsWithoutExamples.length > 2) {
      suggestions.push(
        `${sectionsWithoutExamples.length} section(s) without code examples or links - consider adding references`,
      );
    }

    return suggestions;
  }

  private checkHeadingLevelJumps(result: MarkdownScanResult): string[] {
    const issues: string[] = [];

    for (let i = 1; i < result.sections.length; i++) {
      const prev = result.sections[i - 1];
      const curr = result.sections[i];

      // Check if heading level jumps more than 1 (e.g., H2 to H4)
      if (curr.level > prev.level + 1) {
        issues.push(
          `Heading level jump from ${prev.level} to ${curr.level} at "${curr.title}" (line ${curr.line})`,
        );
      }
    }

    return issues;
  }

  private isTechnicalDoc(result: MarkdownScanResult): boolean {
    const fileName = result.file.split('/').pop()?.toLowerCase() || '';

    // Check if it's likely a technical document based on file name or sections
    const technicalKeywords = ['api', 'reference', 'guide', 'tutorial', 'usage', 'example'];

    if (technicalKeywords.some((keyword) => fileName.includes(keyword))) {
      return true;
    }

    // Check if sections contain technical keywords
    const sectionTitles = result.sections.map((s) => s.title.toLowerCase()).join(' ');
    return technicalKeywords.some((keyword) => sectionTitles.includes(keyword));
  }
}
