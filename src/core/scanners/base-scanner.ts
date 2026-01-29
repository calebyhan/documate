import type { ScanResult } from '../../types/index.js';

export interface BaseScanner {
  scanFile(filePath: string): Promise<ScanResult>;
  supports(filePath: string): boolean;
}
