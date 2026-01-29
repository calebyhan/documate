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

export interface ScanResult {
  file: string;
  language: string;
  functions: FunctionInfo[];
  classes: ClassInfo[];
}

// --- Health types ---

export interface HealthReport {
  overallScore: number;
  coverage: number;
  freshness: number;
  accuracy: number;
  completeness: number;
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
