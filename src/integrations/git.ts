import { simpleGit, type SimpleGit } from 'simple-git';
import type { CommitInfo } from '../types/index.js';

export class GitAnalyzer {
  private git: SimpleGit;

  constructor(repoPath: string = process.cwd()) {
    this.git = simpleGit(repoPath);
  }

  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.revparse(['--is-inside-work-tree']);
      return true;
    } catch {
      return false;
    }
  }

  async getFileHistory(filePath: string, limit: number = 10): Promise<CommitInfo[]> {
    try {
      const log = await this.git.log({ file: filePath, maxCount: limit });
      return log.all.map((entry) => ({
        hash: entry.hash,
        date: entry.date,
        message: entry.message,
        author: entry.author_name,
      }));
    } catch {
      return [];
    }
  }

  async getFileDiff(filePath: string, fromCommit: string, toCommit: string): Promise<string> {
    try {
      return await this.git.diff([`${fromCommit}..${toCommit}`, '--', filePath]);
    } catch {
      return '';
    }
  }

  async getLastModified(filePath: string): Promise<Date> {
    try {
      const log = await this.git.log({ file: filePath, maxCount: 1 });
      return new Date(log.latest?.date ?? Date.now());
    } catch {
      return new Date();
    }
  }

  async getFileAtCommit(filePath: string, commit: string): Promise<string | null> {
    try {
      return await this.git.show([`${commit}:${filePath}`]);
    } catch {
      return null;
    }
  }

  async getChangedFiles(fromCommit?: string): Promise<string[]> {
    try {
      if (fromCommit) {
        const diff = await this.git.diff(['--name-only', fromCommit]);
        return diff.split('\n').filter(Boolean);
      }
      const status = await this.git.status();
      return [...status.modified, ...status.not_added];
    } catch {
      return [];
    }
  }
}
