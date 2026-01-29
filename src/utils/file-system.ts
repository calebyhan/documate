import { readFile } from 'node:fs/promises';
import { glob } from 'glob';
import { extname } from 'node:path';

export async function findFiles(
  patterns: string[],
  exclude: string[],
  cwd: string = process.cwd(),
): Promise<string[]> {
  const files: string[] = [];
  for (const pattern of patterns) {
    const matched = await glob(pattern, { cwd, ignore: exclude, absolute: true });
    files.push(...matched);
  }
  return [...new Set(files)].sort();
}

export async function readFileContent(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

export function getFileExtension(filePath: string): string {
  return extname(filePath).toLowerCase();
}

export function isTypeScriptFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ext === '.ts' || ext === '.tsx';
}

export function isJavaScriptFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ext === '.js' || ext === '.jsx';
}
