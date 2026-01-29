// Completely undocumented utility module

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export function generateRandomToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const parseJWT = (token: string): { header: unknown; payload: unknown; signature: string } | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    return {
      header: JSON.parse(atob(parts[0])),
      payload: JSON.parse(atob(parts[1])),
      signature: parts[2],
    };
  } catch {
    return null;
  }
};
