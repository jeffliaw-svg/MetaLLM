/** Tolerant JSON extraction for model output. */

/**
 * Models wrap JSON in markdown fences, prepend "Here's the analysis:", or
 * trail a closing remark. Strip all of that and parse what's left.
 *
 * Returns null rather than throwing so callers can decide whether to retry.
 */
export function parseJsonLoose<T = unknown>(raw: string): T | null {
  let text = raw.trim();

  // Strip markdown fences.
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    text = text.trim();
  }

  const direct = tryParse<T>(text);
  if (direct !== null) return direct;

  // Fall back to the outermost balanced brace span.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return tryParse<T>(text.slice(start, end + 1));
  }

  return null;
}

function tryParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
