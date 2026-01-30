import { simpleGit, type SimpleGit } from 'simple-git';
import { relative, isAbsolute } from 'node:path';
import type { CommitInfo } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class GitAnalyzer {
  private git: SimpleGit;
  private repoRootCache: string | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(repoPath: string = process.cwd()) {
    // Initialize with provided path first, then we'll switch to repo root
    this.git = simpleGit(repoPath);
  }

  /**
   * Ensures SimpleGit is initialized with the repository root
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      const repoRoot = await this.getRepoRoot();
      this.git = simpleGit(repoRoot);
    })();

    return this.initPromise;
  }

  /**
   * Convert a file path to be relative to the git repository root.
   * Handles both absolute and relative paths.
   */
  private async toRepoRelativePath(filePath: string): Promise<string> {
    if (!isAbsolute(filePath)) {
      return filePath;
    }
    const repoRoot = await this.getRepoRoot();
    return relative(repoRoot, filePath);
  }

  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.revparse(['--is-inside-work-tree']);
      return true;
    } catch (err) {
      logger.debug(`Not a git repository: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  async getFileHistory(filePath: string, limit: number = 10, since?: string): Promise<CommitInfo[]> {
    try {
      await this.ensureInitialized();
      const relPath = await this.toRepoRelativePath(filePath);
      logger.debug(`Getting file history for ${relPath} (limit: ${limit}${since ? `, since: ${since}` : ''})`);
      const logOptions: any = { file: relPath, maxCount: limit };
      if (since) {
        logOptions['--since'] = since;
      }
      const log = await this.git.log(logOptions);
      return log.all.map((entry) => ({
        hash: entry.hash,
        date: entry.date,
        message: entry.message,
        author: entry.author_name,
      }));
    } catch (err) {
      logger.warn(`Failed to get file history for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  async getFileDiff(filePath: string, fromCommit: string, toCommit: string): Promise<string> {
    try {
      await this.ensureInitialized();
      const relPath = await this.toRepoRelativePath(filePath);
      logger.debug(`Getting diff for ${relPath} from ${fromCommit} to ${toCommit}`);
      return await this.git.diff([`${fromCommit}..${toCommit}`, '--', relPath]);
    } catch (err) {
      logger.warn(`Failed to get diff for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      return '';
    }
  }

  async getLastModified(filePath: string): Promise<Date> {
    try {
      await this.ensureInitialized();
      const relPath = await this.toRepoRelativePath(filePath);
      logger.debug(`Getting last modified date for ${relPath}`);
      const log = await this.git.log({ file: relPath, maxCount: 1 });
      return new Date(log.latest?.date ?? Date.now());
    } catch (err) {
      logger.warn(`Failed to get last modified date for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      return new Date();
    }
  }

  async getRepoRoot(): Promise<string> {
    if (this.repoRootCache) {
      return this.repoRootCache;
    }
    try {
      const root = await this.git.revparse(['--show-toplevel']);
      this.repoRootCache = root.trim();
      return this.repoRootCache;
    } catch (err) {
      logger.warn(`Failed to get repo root: ${err instanceof Error ? err.message : String(err)}`);
      this.repoRootCache = process.cwd();
      return this.repoRootCache;
    }
  }

  async getFileAtCommit(filePath: string, commit: string): Promise<string | null> {
    try {
      await this.ensureInitialized();
      const relPath = await this.toRepoRelativePath(filePath);
      logger.debug(`Getting ${relPath} at commit ${commit}`);
      return await this.git.show([`${commit}:${relPath}`]);
    } catch (err) {
      logger.warn(`Failed to get file at commit ${commit}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async getChangedFiles(fromCommit?: string): Promise<string[]> {
    try {
      await this.ensureInitialized();
      logger.debug(`Getting changed files${fromCommit ? ` from ${fromCommit}` : ''}`);
      if (fromCommit) {
        const diff = await this.git.diff(['--name-only', fromCommit]);
        return diff.split('\n').filter(Boolean);
      }
      const status = await this.git.status();
      return [...status.modified, ...status.not_added];
    } catch (err) {
      logger.warn(`Failed to get changed files: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }
}
