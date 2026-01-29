import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { DocuMateConfig } from '../types/index.js';

const CONFIG_FILE = '.documate.json';
const CACHE_DIR = '.documate';

export const DEFAULT_CONFIG: DocuMateConfig = {
  version: '1.0',
  scan: {
    include: ['**/*.{ts,tsx,js,jsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts', '**/*.d.ts'],
    languages: ['typescript', 'javascript'],
  },
  documentation: {
    style: 'jsdoc',
    requireExamples: false,
  },
  drift: {
    maxDriftDays: 30,
    maxDriftScore: 7,
  },
};

export async function loadConfig(cwd: string = process.cwd()): Promise<DocuMateConfig> {
  const configPath = join(cwd, CONFIG_FILE);
  try {
    const content = await readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(content) as Partial<DocuMateConfig>;
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: DocuMateConfig, cwd: string = process.cwd()): Promise<void> {
  const configPath = join(cwd, CONFIG_FILE);
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
}

export async function ensureCacheDir(cwd: string = process.cwd()): Promise<string> {
  const cacheDir = join(cwd, CACHE_DIR);
  if (!existsSync(cacheDir)) {
    await mkdir(cacheDir, { recursive: true });
  }
  return cacheDir;
}

export async function saveScanCache(data: unknown, cwd: string = process.cwd()): Promise<void> {
  const cacheDir = await ensureCacheDir(cwd);
  const cachePath = join(cacheDir, 'scan-results.json');
  await writeFile(cachePath, JSON.stringify(data, null, 2));
}

export async function loadScanCache(cwd: string = process.cwd()): Promise<unknown | null> {
  const cachePath = join(cwd, CACHE_DIR, 'scan-results.json');
  try {
    const content = await readFile(cachePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}
