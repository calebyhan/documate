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
