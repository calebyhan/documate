// Various validation utilities - mostly undocumented

/**
 * Validates email format
 * @param email - Email to validate
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// No docs
export function isValidPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

// Complex validation, no docs
/**
 * Validates order input data to ensure it meets all required criteria for processing an order.
 * Performs comprehensive validation of order structure, user identification, items, and total amount.
 *
 * @param {unknown} input - The input data to validate, expected to be an order object
 * @returns {{ valid: boolean; error?: string }} Validation result object
 *   - `valid`: `true` if validation passes, `false` otherwise
 *   - `error`: Error message describing what failed (only present when `valid` is `false`)
 *
 * @example
 * // Valid order
 * const result = validateOrderInput({
 *   userId: "user123",
 *   items: [
 *     { productId: "prod1", quantity: 2, price: 29.99 },
 *     { productId: "prod2", quantity: 1, price: 15.50 }
 *   ],
 *   total: 75.48
 * });
 * // Returns: { valid: true }
 *
 * @example
 * // Invalid order - missing userId
 * const result = validateOrderInput({
 *   items: [{ productId: "prod1", quantity: 1, price: 10 }],
 *   total: 10
 * });
 * // Returns: { valid: false, error: "userId is required" }
 *
 * @throws {never} Does not throw errors; returns validation results in the return object
 *
 * @remarks
 * - The input type is intentionally `unknown` for runtime type safety
 * - All items must have `productId`, `quantity`, and `price` properties
 * - The `total` must be a positive number greater than zero
 * - Empty item arrays are not permitted
 * - The function does not verify if the total matches the sum of item prices
 */
export function validateOrderInput(input: unknown): { valid: boolean; error?: string } {
  if (typeof input !== 'object' || input === null) {
    return { valid: false, error: 'Input must be an object' };
  }

  const data = input as Record<string, unknown>;

  if (!data.userId || typeof data.userId !== 'string') {
    return { valid: false, error: 'userId is required' };
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { valid: false, error: 'items must be a non-empty array' };
  }

  for (const item of data.items) {
    if (typeof item !== 'object' || !item) {
      return { valid: false, error: 'Invalid item format' };
    }

    const orderItem = item as Record<string, unknown>;
    if (!orderItem.productId || !orderItem.quantity || !orderItem.price) {
      return { valid: false, error: 'Item missing required fields' };
    }
  }

  if (typeof data.total !== 'number' || data.total <= 0) {
    return { valid: false, error: 'total must be a positive number' };
  }

  return { valid: true };
}

export const sanitizeHtml = (input: string): string => {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};
