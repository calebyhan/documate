import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { CopilotResponse } from '../types/index.js';
import { extractJsonFromResponse } from './parsers.js';
import { logger } from '../utils/logger.js';

const DEFAULT_TIMEOUT = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

export class CopilotWrapper {
  private timeout: number;
  private cache: Map<string, CopilotResponse> = new Map();

  constructor(timeout: number = DEFAULT_TIMEOUT) {
    this.timeout = timeout;
  }

  /**
   * Use Copilot to explain code or analyze semantics (for drift detection, analysis)
   */
  async explain(prompt: string, options?: { skipCache?: boolean }): Promise<CopilotResponse> {
    return this.runWithRetry(async () => {
      const cacheKey = this.getCacheKey('explain', prompt);

      // Check cache
      if (!options?.skipCache && this.cache.has(cacheKey)) {
        logger.debug('Using cached Copilot response');
        return this.cache.get(cacheKey)!;
      }

      const output = await this.runGhCopilot('explain', prompt);
      const response = this.processResponse(output);

      // Cache successful responses
      if (response.success) {
        this.cache.set(cacheKey, response);
      }

      return response;
    });
  }

  /**
   * Use Copilot to generate/suggest documentation or code (for doc generation)
   */
  async suggest(prompt: string, options?: { skipCache?: boolean }): Promise<CopilotResponse> {
    return this.runWithRetry(async () => {
      const cacheKey = this.getCacheKey('suggest', prompt);

      // Check cache
      if (!options?.skipCache && this.cache.has(cacheKey)) {
        logger.debug('Using cached Copilot response');
        return this.cache.get(cacheKey)!;
      }

      const output = await this.runGhCopilot('suggest', prompt);
      const response = this.processResponse(output);

      // Cache successful responses
      if (response.success) {
        this.cache.set(cacheKey, response);
      }

      return response;
    });
  }

  /**
   * Process Copilot output and validate response
   */
  private processResponse(output: string): CopilotResponse {
    // Check for refusals or errors in the output
    const lowerOutput = output.toLowerCase();
    if (lowerOutput.includes('i cannot') ||
        lowerOutput.includes('i am unable') ||
        lowerOutput.includes('i can\'t') ||
        lowerOutput.includes('sorry, i cannot')) {
      logger.warn('Copilot declined to respond');
      return {
        raw: output,
        success: false,
        error: 'Copilot declined to respond to this request',
      };
    }

    const parsed = extractJsonFromResponse(output);

    // Validate that parsing was successful when JSON is expected
    if (!parsed && (lowerOutput.includes('{') || lowerOutput.includes('json'))) {
      logger.warn('Failed to parse JSON from Copilot response');
      return {
        raw: output,
        success: false,
        error: 'Failed to parse JSON from response',
      };
    }

    return {
      raw: output,
      parsed: parsed ?? undefined,
      success: true,
    };
  }

  /**
   * Execute function with retry logic for transient failures
   */
  private async runWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.debug(`Copilot request attempt ${attempt + 1} failed: ${lastError.message}`);

        // Don't retry on auth errors or command not found
        if (lastError.message.includes('auth') ||
            lastError.message.includes('not found') ||
            lastError.message.includes('not installed')) {
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, attempt);
          logger.debug(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    logger.error(`Copilot request failed after ${MAX_RETRIES + 1} attempts`);
    throw lastError!;
  }

  /**
   * Generate cache key from command and prompt
   */
  private getCacheKey(command: string, prompt: string): string {
    const hash = createHash('sha256');
    hash.update(`${command}:${prompt}`);
    return hash.digest('hex');
  }

  /**
   * Clear the response cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Copilot cache cleared');
  }

  async checkPrerequisites(): Promise<{ ok: boolean; error?: string }> {
    // Check gh is installed
    try {
      await this.runCommand('gh', ['--version']);
    } catch {
      return { ok: false, error: 'GitHub CLI (gh) is not installed. Install it from https://cli.github.com/' };
    }

    // Check copilot command is available (either built-in or as extension)
    try {
      await this.runCommand('gh', ['copilot', '--help']);
    } catch {
      return { ok: false, error: 'GitHub Copilot not available. Ensure you have gh CLI v2.50.0+ or run: gh extension install github/gh-copilot' };
    }

    // Check auth
    try {
      await this.runCommand('gh', ['auth', 'status']);
    } catch {
      return { ok: false, error: 'Not authenticated with GitHub. Run: gh auth login' };
    }

    return { ok: true };
  }

  private runGhCopilot(command: 'explain' | 'suggest', prompt: string): Promise<string> {
    logger.debug(`Running gh copilot ${command}`);

    return new Promise((resolve, reject) => {
      const child = spawn('gh', ['copilot', command, prompt], {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('Copilot request timed out'));
      }, this.timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(stderr || `Copilot CLI exited with code ${code}`));
        } else {
          resolve(stdout);
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  private runCommand(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      child.on('close', (code) => {
        if (code !== 0) reject(new Error(stderr || `Command failed with code ${code}`));
        else resolve(stdout);
      });

      child.on('error', reject);
    });
  }
}
