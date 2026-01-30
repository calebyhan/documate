import { simpleGit, type SimpleGit } from 'simple-git';
import type { CommitInfo } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class GitAnalyzer {
  private git: SimpleGit;

  constructor(repoPath: string = process.cwd()) {
    this.git = simpleGit(repoPath);
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
      logger.debug(`Getting file history for ${filePath} (limit: ${limit}${since ? `, since: ${since}` : ''})`);
      const logOptions: any = { file: filePath, maxCount: limit };
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
      logger.debug(`Getting diff for ${filePath} from ${fromCommit} to ${toCommit}`);
      return await this.git.diff([`${fromCommit}..${toCommit}`, '--', filePath]);
    } catch (err) {
      logger.warn(`Failed to get diff for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      return '';
    }
  }

  async getLastModified(filePath: string): Promise<Date> {
    try {
      logger.debug(`Getting last modified date for ${filePath}`);
      const log = await this.git.log({ file: filePath, maxCount: 1 });
      return new Date(log.latest?.date ?? Date.now());
    } catch (err) {
      logger.warn(`Failed to get last modified date for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      return new Date();
    }
  }

  async getFileAtCommit(filePath: string, commit: string): Promise<string | null> {
    try {
      logger.debug(`Getting ${filePath} at commit ${commit}`);
      return await this.git.show([`${commit}:${filePath}`]);
    } catch (err) {
      logger.warn(`Failed to get file at commit ${commit}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async getChangedFiles(fromCommit?: string): Promise<string[]> {
    try {
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
