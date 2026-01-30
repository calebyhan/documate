import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ScannerRegistry } from '../../src/core/scanners/scanner-registry.js';

describe('Scanner Registry', () => {
  describe('File type support', () => {
    it('should support TypeScript files', () => {
      const registry = ScannerRegistry.getInstance();
      assert.ok(registry.isSupported('/path/to/file.ts'));
      assert.ok(registry.isSupported('/path/to/file.tsx'));
    });

    it('should support Python files', () => {
      const registry = ScannerRegistry.getInstance();
      assert.ok(registry.isSupported('/path/to/file.py'));
    });

    it('should support Markdown files', () => {
      const registry = ScannerRegistry.getInstance();
      assert.ok(registry.isSupported('/path/to/file.md'));
    });

    it('should not support unsupported file types', () => {
      const registry = ScannerRegistry.getInstance();
      assert.ok(!registry.isSupported('/path/to/file.txt'));
      assert.ok(!registry.isSupported('/path/to/file.java'));
      assert.ok(!registry.isSupported('/path/to/file.cpp'));
    });
  });

  describe('Scanner retrieval', () => {
    it('should return TypeScript scanner for .ts files', () => {
      const registry = ScannerRegistry.getInstance();
      const scanner = registry.getScanner('/path/to/file.ts');
      assert.ok(scanner !== null);
    });

    it('should return Python scanner for .py files', () => {
      const registry = ScannerRegistry.getInstance();
      const scanner = registry.getScanner('/path/to/file.py');
      assert.ok(scanner !== null);
    });

    it('should return Markdown scanner for .md files', () => {
      const registry = ScannerRegistry.getInstance();
      const scanner = registry.getScanner('/path/to/file.md');
      assert.ok(scanner !== null);
    });

    it('should return null for unsupported files', () => {
      const registry = ScannerRegistry.getInstance();
      const scanner = registry.getScanner('/path/to/file.unknown');
      assert.strictEqual(scanner, null);
    });
  });

  describe('Singleton pattern', () => {
    it('should return same instance', () => {
      const registry1 = ScannerRegistry.getInstance();
      const registry2 = ScannerRegistry.getInstance();
      assert.strictEqual(registry1, registry2);
    });
  });
});
