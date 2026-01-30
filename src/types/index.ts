// --- Scanner types ---

export interface ParameterInfo {
  name: string;
  type: string;
  isOptional: boolean;
  defaultValue?: string;
  description?: string;
}

export interface FunctionInfo {
  name: string;
  type: 'function' | 'method' | 'arrow';
  params: ParameterInfo[];
  returnType: string;
  hasDocumentation: boolean;
  documentation?: string;
  isExported: boolean;
  isAsync: boolean;
  visibility: 'public' | 'private' | 'protected' | 'internal';
  location: {
    file: string;
    startLine: number;
    endLine: number;
  };
  complexity: {
    linesOfCode: number;
    cyclomaticComplexity: number;
  };
}

export interface PropertyInfo {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'protected';
  hasDocumentation: boolean;
}

export interface ClassInfo {
  name: string;
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  hasDocumentation: boolean;
  documentation?: string;
  isExported: boolean;
  location: {
    file: string;
    startLine: number;
    endLine: number;
  };
}

// Base result type for all scanners
export interface BaseScanResult {
  file: string;
  language: 'typescript' | 'javascript' | 'python' | 'markdown';
}

// Code-specific result (TypeScript, JavaScript, Python)
export interface CodeScanResult extends BaseScanResult {
  language: 'typescript' | 'javascript' | 'python';
  functions: FunctionInfo[];
  classes: ClassInfo[];
}

// Markdown-specific types
export interface SectionInfo {
  level: number; // 1-6 for h1-h6
  title: string;
  content: string;
  line: number;
  subsections: SectionInfo[];
}

export interface LinkInfo {
  text: string;
  url: string;
  line: number;
  isInternal: boolean;
  isValid?: boolean; // Set by LinkValidator
}

export interface CodeBlockInfo {
  language: string;
  code: string;
  line: number;
}

export interface CodeReferenceInfo {
  type: 'function' | 'class' | 'method' | 'type';
  name: string;
  line: number;
  context: string;
  resolved?: boolean; // Set by CrossReferenceValidator
}

// Markdown-specific result
export interface MarkdownScanResult extends BaseScanResult {
  language: 'markdown';
  sections: SectionInfo[];
  links: LinkInfo[];
  codeBlocks: CodeBlockInfo[];
  codeReferences: CodeReferenceInfo[];
  metadata?: Record<string, string>; // frontmatter
}

// Discriminated union of all scan result types
export type ScanResult = CodeScanResult | MarkdownScanResult;

// Type guards
export function isCodeResult(result: ScanResult): result is CodeScanResult {
  return ['typescript', 'javascript', 'python'].includes(result.language);
}

export function isMarkdownResult(result: ScanResult): result is MarkdownScanResult {
  return result.language === 'markdown';
}

// --- Health types ---

export interface MarkdownHealthReport {
  overallScore: number;
  contentCompleteness: number;
  linkHealth: number;
  structureScore: number;
  issues: MarkdownIssue[];
}

export interface MarkdownFileHealthReport {
  file: string;
  score: number;
  issues: string[];
  suggestions: string[];
  expectedSections: string[];
  missingSections: string[];
  emptySections: string[];
  hasCodeExamples: boolean;
  sectionCount: number;
}

export interface MarkdownIssue {
  file: string;
  line: number;
  type: 'broken-link' | 'missing-section' | 'outdated-example' | 'broken-reference' | 'invalid-structure';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestion?: string;
}

export interface HealthReport {
  overallScore: number;
  coverage: number;
  freshness: number;
  accuracy: number;
  completeness: number;
  markdownHealth?: MarkdownHealthReport;
  crossReferenceReport?: CrossReferenceReport;
  issues: DebtIssue[];
}

export interface DebtIssue {
  file: string;
  functionName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  priority: number;
  reason: string;
  suggestion?: string;
  copilotAnalysis?: {
    purpose: string;
    complexity: number;
    suggestedTopics: string[];
  };
}

// --- Drift types ---

export interface DriftReport {
  file: string;
  functionName: string;
  driftScore: number;
  lastCodeChange: Date;
  lastDocUpdate: Date;
  changes: SemanticChange[];
  recommendation: string;
}

export interface SemanticChange {
  type: string;
  description: string;
  impact: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  isBreaking: boolean;
}

// --- Cross-Reference types ---

export interface CrossReferenceReport {
  totalReferences: number;
  resolvedReferences: number;
  unresolvedReferences: UnresolvedReference[];
  resolutionRate: number;
}

export interface CrossReferenceValidationResult {
  file: string;
  totalReferences: number;
  brokenReferences: Array<{
    reference: string;
    location: string;
    lineNumber: number;
    suggestion?: string;
  }>;
  validReferences: Array<{ reference: string; foundIn: string[] }>;
  warnings: string[];
}

export interface UnresolvedReference {
  file: string;
  line: number;
  name: string;
  type: 'function' | 'class' | 'method' | 'type';
  context: string;
}

// --- Link Validation types ---

export interface LinkValidationReport {
  totalLinks: number;
  validLinks: number;
  brokenLinks: LinkIssue[];
}

export interface LinkValidationFileReport {
  file: string;
  totalLinks: number;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: Array<{ link: string; reason: string; lineNumber: number }>;
  validLinks: string[];
  warnings: string[];
}

export interface LinkIssue {
  file: string;
  line: number;
  url: string;
  text: string;
  reason: string;
}

// --- Markdown Drift types ---

export interface MarkdownDriftReport {
  file: string;
  driftScore: number;
  outdatedExamples: OutdatedExampleIssue[];
  brokenReferences: BrokenReferenceIssue[];
  staleSections: StaleSectionIssue[];
}

export interface MarkdownDriftFileReport {
  file: string;
  driftScore: number;
  lastModified: string;
  outdatedSections: Array<{
    section: string;
    reason: string;
    lineNumber: number;
  }>;
  staleReferences: Array<{
    reference: string;
    lastModified: string;
    codeLastModified: string;
  }>;
  suggestions: string[];
}

export interface OutdatedExampleIssue {
  line: number;
  codeBlock: string;
  reason: string;
  currentSignature?: string;
}

export interface BrokenReferenceIssue {
  line: number;
  reference: string;
  reason: string;
}

export interface StaleSectionIssue {
  section: string;
  line: number;
  lastModified: Date;
  referencedCode: string[];
  codeLastModified: Date;
}

// --- Config types ---

export interface DocuMateConfig {
  version: string;
  scan: {
    include: string[];
    exclude: string[];
    languages: string[];
  };
  documentation: {
    style: 'jsdoc' | 'tsdoc';
    requireExamples: boolean;
  };
  drift: {
    maxDriftDays: number;
    maxDriftScore: number;
  };
  markdown?: {
    docsDirectory: string;
    expectedSections: Record<string, string[]>;
    validateLinks: boolean;
    validateCodeExamples: boolean;
    checkCrossReferences: boolean;
  };
  python?: {
    docstringStyle: 'google' | 'numpy' | 'sphinx' | 'auto';
  };
}

// --- Copilot types ---

export interface CopilotResponse {
  raw: string;
  parsed?: Record<string, unknown>;
  success: boolean;
  error?: string;
}

// --- Git types ---

export interface CommitInfo {
  hash: string;
  date: string;
  message: string;
  author: string;
}
