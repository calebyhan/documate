import { describe, it } from 'node:test';
import assert from 'node:assert';
import { extractJsonFromResponse } from '../../src/copilot/parsers.js';

describe('Copilot Parsers', () => {
  describe('extractJsonFromResponse', () => {
    it('should extract JSON from markdown code blocks', () => {
      const response = `Here's the analysis:

\`\`\`json
{
  "purpose": "Test function",
  "complexity": {
    "score": 5
  }
}
\`\`\`

That's the result.`;

      const result = extractJsonFromResponse(response);
      assert.ok(result);
      assert.strictEqual(result.purpose, 'Test function');
      assert.strictEqual(result.complexity.score, 5);
    });

    it('should extract raw JSON without code blocks', () => {
      const response = `{"status": "success", "value": 42}`;
      const result = extractJsonFromResponse(response);
      assert.ok(result);
      assert.strictEqual(result.status, 'success');
      assert.strictEqual(result.value, 42);
    });

    it('should handle JSON embedded in text', () => {
      const response = `Some explanation text { "key": "value", "number": 123 } more text`;
      const result = extractJsonFromResponse(response);
      assert.ok(result);
      assert.strictEqual(result.key, 'value');
      assert.strictEqual(result.number, 123);
    });

    it('should return null for non-JSON responses', () => {
      const response = 'This is just plain text without any JSON';
      const result = extractJsonFromResponse(response);
      assert.strictEqual(result, null);
    });

    it('should handle nested JSON structures', () => {
      const response = `\`\`\`json
{
  "nested": {
    "deep": {
      "value": "found"
    }
  },
  "array": [1, 2, 3]
}
\`\`\``;

      const result = extractJsonFromResponse(response);
      assert.ok(result);
      assert.strictEqual(result.nested.deep.value, 'found');
      assert.deepStrictEqual(result.array, [1, 2, 3]);
    });

    it('should handle invalid JSON gracefully', () => {
      const response = `\`\`\`json
{ invalid json here }
\`\`\``;

      const result = extractJsonFromResponse(response);
      assert.strictEqual(result, null);
    });
  });
});
