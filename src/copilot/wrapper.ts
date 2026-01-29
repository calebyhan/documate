import { spawn } from 'node:child_process';
import type { CopilotResponse } from '../types/index.js';
import { extractJsonFromResponse } from './parsers.js';

const DEFAULT_TIMEOUT = 30_000;

export class CopilotWrapper {
  private timeout: number;

  constructor(timeout: number = DEFAULT_TIMEOUT) {
    this.timeout = timeout;
  }

  async explain(prompt: string): Promise<CopilotResponse> {
    try {
      const output = await this.runGhCopilot(prompt);
      const parsed = extractJsonFromResponse(output);

      return {
        raw: output,
        parsed: parsed ?? undefined,
        success: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        raw: '',
        success: false,
        error: message,
      };
    }
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

  private runGhCopilot(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('gh', ['copilot', 'explain', prompt], {
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
