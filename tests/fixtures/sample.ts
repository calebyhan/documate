/**
 * Adds two numbers together.
 *
 * @param a - The first number
 * @param b - The second number
 * @returns The sum of a and b
 *
 * @example
 * const result = add(1, 2);
 * console.log(result); // 3
 */
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * Divides two numbers.
 *
 * @param a - The dividend
 * @param b - The divisor
 * @returns The result of dividing a by b
 */
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

export async function fetchData(url: string, options?: { timeout?: number; retries?: number }): Promise<unknown> {
  const timeout = options?.timeout ?? 5000;
  const retries = options?.retries ?? 3;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      if (attempt === retries - 1) throw err;
    }
  }

  throw new Error('All retries exhausted');
}

const processItems = (items: string[], transform: (item: string) => string): string[] => {
  return items.map(transform);
};

export class Calculator {
  private history: number[] = [];

  /**
   * Adds a value to the running total.
   * @param value - The value to add
   */
  add(value: number): void {
    this.history.push(value);
  }

  getTotal(): number {
    return this.history.reduce((sum, v) => sum + v, 0);
  }

  reset(): void {
    this.history = [];
  }

  getHistory(): number[] {
    return [...this.history];
  }
}
