import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  analyzeCodePrompt,
  detectDriftPrompt,
  generateDocPrompt,
  fixExamplePrompt,
} from '../../src/copilot/prompts.js';

describe('Copilot Prompts', () => {
  describe('analyzeCodePrompt', () => {
    it('should include function code in prompt', () => {
      const code = 'function test() { return 42; }';
      const prompt = analyzeCodePrompt(code, 'test', 'test context');

      assert.ok(prompt.includes(code));
      assert.ok(prompt.includes('test'));
      assert.ok(prompt.includes('test context'));
    });

    it('should request JSON format', () => {
      const prompt = analyzeCodePrompt('code', 'fn', 'ctx');
      assert.ok(prompt.includes('JSON'));
      assert.ok(prompt.includes('purpose'));
      assert.ok(prompt.includes('complexity'));
    });

    it('should ask for documentation priority', () => {
      const prompt = analyzeCodePrompt('code', 'fn', 'ctx');
      assert.ok(prompt.includes('documentationPriority'));
    });
  });

  describe('detectDriftPrompt', () => {
    it('should include old and new code versions', () => {
      const oldCode = 'function old() {}';
      const newCode = 'function new() {}';
      const docs = '/** Old docs */';

      const prompt = detectDriftPrompt(oldCode, newCode, docs);

      assert.ok(prompt.includes(oldCode));
      assert.ok(prompt.includes(newCode));
      assert.ok(prompt.includes(docs));
    });

    it('should ask to distinguish semantic vs cosmetic changes', () => {
      const prompt = detectDriftPrompt('old', 'new', 'docs');
      assert.ok(prompt.includes('SEMANTIC'));
      assert.ok(prompt.includes('cosmetic'));
    });

    it('should request drift analysis structure', () => {
      const prompt = detectDriftPrompt('old', 'new', 'docs');
      assert.ok(prompt.includes('hasSemanticChanges'));
      assert.ok(prompt.includes('driftScore'));
      assert.ok(prompt.includes('recommendation'));
    });
  });

  describe('generateDocPrompt', () => {
    it('should include code and style', () => {
      const code = 'function example() {}';
      const style = 'jsdoc';

      const prompt = generateDocPrompt(code, style);

      assert.ok(prompt.includes(code));
      assert.ok(prompt.includes(style));
    });

    it('should request documentation components', () => {
      const prompt = generateDocPrompt('code', 'jsdoc');
      assert.ok(prompt.includes('Clear description'));
      assert.ok(prompt.includes('All parameters'));
      assert.ok(prompt.includes('Return value'));
      assert.ok(prompt.includes('usage example'));
    });

    it('should work with different styles', () => {
      const jsdocPrompt = generateDocPrompt('code', 'jsdoc');
      const tsdocPrompt = generateDocPrompt('code', 'tsdoc');

      assert.ok(jsdocPrompt.includes('jsdoc'));
      assert.ok(tsdocPrompt.includes('tsdoc'));
    });
  });

  describe('fixExamplePrompt', () => {
    it('should include example, code, and error', () => {
      const example = 'example code';
      const currentCode = 'current code';
      const error = 'Error message';

      const prompt = fixExamplePrompt(example, currentCode, error);

      assert.ok(prompt.includes(example));
      assert.ok(prompt.includes(currentCode));
      assert.ok(prompt.includes(error));
    });

    it('should request fix explanation', () => {
      const prompt = fixExamplePrompt('ex', 'code', 'err');
      assert.ok(prompt.includes('explanation'));
      assert.ok(prompt.includes('fixedExample'));
      assert.ok(prompt.includes('isBreakingChange'));
    });
  });
});
