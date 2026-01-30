import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import chalk from 'chalk';
import type { CopilotResponse } from '../types/index.js';
import { extractJsonFromResponse } from './parsers.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

const DEFAULT_TIMEOUT = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

let explainMode = false;

export function setExplainMode(enabled: boolean): void {
  explainMode = enabled;
}

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
      const startTime = Date.now();
      let fromCache = false;

      // Check cache
      if (!options?.skipCache && this.cache.has(cacheKey)) {
        logger.debug('Using cached Copilot response');
        fromCache = true;
        const cached = this.cache.get(cacheKey)!;
        metrics.recordCopilotCall('explain', 0, true);

        if (explainMode) {
          this.showExplainOutput('explain', prompt, cached.raw, true);
        }

        return cached;
      }

      if (explainMode) {
        console.log(chalk.cyan('\n🤖 GitHub Copilot CLI - Explain Mode'));
        console.log(chalk.dim('━'.repeat(60)));
        console.log(chalk.bold('📤 Prompt sent to Copilot:'));
        console.log(chalk.dim(this.truncatePrompt(prompt)));
        console.log(chalk.dim('━'.repeat(60)));
      }

      const output = await this.runGhCopilot('explain', prompt);
      const response = this.processResponse(output);
      const duration = Date.now() - startTime;

      // Record metrics
      if (response.success) {
        metrics.recordCopilotCall('explain', duration, false);
      } else {
        metrics.recordCopilotFailure();
      }

      if (explainMode) {
        this.showExplainOutput('explain', prompt, output, false);
      }

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
      const startTime = Date.now();
      let fromCache = false;

      // Check cache
      if (!options?.skipCache && this.cache.has(cacheKey)) {
        logger.debug('Using cached Copilot response');
        fromCache = true;
        const cached = this.cache.get(cacheKey)!;
        metrics.recordCopilotCall('suggest', 0, true);

        if (explainMode) {
          this.showExplainOutput('suggest', prompt, cached.raw, true);
        }

        return cached;
      }

      if (explainMode) {
        console.log(chalk.cyan('\n🤖 GitHub Copilot CLI - Suggest Mode'));
        console.log(chalk.dim('━'.repeat(60)));
        console.log(chalk.bold('📤 Prompt sent to Copilot:'));
        console.log(chalk.dim(this.truncatePrompt(prompt)));
        console.log(chalk.dim('━'.repeat(60)));
      }

      const output = await this.runGhCopilot('suggest', prompt);
      const response = this.processResponse(output);
      const duration = Date.now() - startTime;

      // Record metrics
      if (response.success) {
        metrics.recordCopilotCall('suggest', duration, false);
      } else {
        metrics.recordCopilotFailure();
      }

      if (explainMode) {
        this.showExplainOutput('suggest', prompt, output, false);
      }

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

    // Try to extract JSON if present
    const parsed = extractJsonFromResponse(output);

    // For non-JSON responses (like JSDoc), success is still true if we got output
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

  /**
   * Display explain mode output
   */
  private showExplainOutput(command: string, prompt: string, response: string, fromCache: boolean): void {
    if (fromCache) {
      console.log(chalk.yellow('💾 Response from cache'));
    } else {
      console.log(chalk.bold('📥 Copilot response:'));
      console.log(chalk.dim(this.truncateResponse(response)));
    }
    console.log(chalk.dim('━'.repeat(60) + '\n'));
  }

  /**
   * Truncate prompt for display
   */
  private truncatePrompt(prompt: string): string {
    const maxLength = 500;
    if (prompt.length <= maxLength) {
      return prompt;
    }
    return prompt.substring(0, maxLength) + '\n... (truncated)';
  }

  /**
   * Truncate response for display
   */
  private truncateResponse(response: string): string {
    const maxLength = 800;
    if (response.length <= maxLength) {
      return response;
    }
    return response.substring(0, maxLength) + '\n... (truncated)';
  }

  async checkPrerequisites(): Promise<{ ok: boolean; error?: string }> {
    // Check gh is installed
    try {
      await this.runCommand('gh', ['--version']);
    } catch {
      return { ok: false, error: 'GitHub CLI (gh) is not installed. Install it from https://cli.github.com/' };
    }

    // Check copilot command is available (new CLI)
    try {
      await this.runCommand('gh', ['copilot', '--', '--version']);
    } catch {
      return { ok: false, error: 'GitHub Copilot CLI not available. Run: gh copilot (it will auto-install)' };
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
      // New Copilot CLI syntax: gh copilot -- -p "prompt" --allow-all-tools
      const child = spawn('gh', ['copilot', '--', '-p', prompt, '--allow-all-tools'], {
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
