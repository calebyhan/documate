export function extractJsonFromResponse(raw: string): Record<string, unknown> | null {
  // Strategy 1: Look for JSON in markdown code fences
  const fenceMatch = raw.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // Fall through
    }
  }

  // Strategy 2: Find raw JSON object
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(raw.substring(start, end + 1));
    } catch {
      // Fall through
    }
  }

  // Strategy 3: Find raw JSON array
  const arrStart = raw.indexOf('[');
  const arrEnd = raw.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      const parsed = JSON.parse(raw.substring(arrStart, arrEnd + 1));
      return { items: parsed };
    } catch {
      // Fall through
    }
  }

  return null;
}

export function extractCodeBlockFromResponse(raw: string): string | null {
  const match = raw.match(/```(?:typescript|javascript|ts|js)?\s*\n([\s\S]*?)\n\s*```/);
  return match ? match[1].trim() : null;
}
