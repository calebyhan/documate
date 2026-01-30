import path from 'node:path';
import type { BaseScanner } from './base-scanner.js';
import { TypeScriptScanner } from './typescript-scanner.js';
import { MarkdownScanner } from './markdown-scanner.js';
import { PythonScanner } from './python-scanner.js';

export class ScannerRegistry {
  private static instance: ScannerRegistry | null = null;
  private scannerMap: Map<string, BaseScanner> = new Map();
  private extensionMap: Map<string, BaseScanner> = new Map();

  private constructor() {
    // Register default scanners
    this.register(new TypeScriptScanner(), ['.ts', '.tsx', '.js', '.jsx']);
    this.register(new MarkdownScanner(), ['.md']);
    this.register(new PythonScanner(), ['.py']);
  }

  /**
   * Get the singleton instance of ScannerRegistry
   */
  public static getInstance(): ScannerRegistry {
    if (!ScannerRegistry.instance) {
      ScannerRegistry.instance = new ScannerRegistry();
    }
    return ScannerRegistry.instance;
  }

  /**
   * Register a scanner for specific file extensions
   */
  public register(scanner: BaseScanner, extensions: string[]): void {
    const scannerName = scanner.constructor.name;
    this.scannerMap.set(scannerName, scanner);

    for (const ext of extensions) {
      const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
      this.extensionMap.set(normalizedExt.toLowerCase(), scanner);
    }
  }

  /**
   * Get the appropriate scanner for a file path
   */
  public getScanner(filePath: string): BaseScanner | null {
    const ext = path.extname(filePath).toLowerCase();
    return this.extensionMap.get(ext) || null;
  }

  /**
   * Get all registered scanners
   */
  public getAllScanners(): BaseScanner[] {
    return Array.from(this.scannerMap.values());
  }

  /**
   * Get all supported file extensions
   */
  public getSupportedExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }

  /**
   * Check if a file is supported by any scanner
   */
  public isSupported(filePath: string): boolean {
    return this.getScanner(filePath) !== null;
  }

  /**
   * Reset the registry (useful for testing)
   */
  public static reset(): void {
    ScannerRegistry.instance = null;
  }
}
