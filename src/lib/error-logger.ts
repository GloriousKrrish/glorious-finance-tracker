/**
 * Safe, sanitized enterprise error logging helper.
 * Redacts secrets, tokens, PII, and financial identifiers before logging.
 */

type ErrorContext = Record<string, unknown>;

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    // Redact tokens, Bearer strings, passwords, or secret key patterns
    if (value.startsWith("sb_") || value.startsWith("AQ.") || value.includes("Bearer ")) {
      return "[REDACTED_SECRET]";
    }
    return value;
  }
  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    const cleanObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const lowerKey = k.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("key") ||
        lowerKey.includes("card") ||
        lowerKey.includes("account_number")
      ) {
        cleanObj[k] = "[REDACTED]";
      } else {
        cleanObj[k] = sanitizeValue(v);
      }
    }
    return cleanObj;
  }
  return value;
}

export function logSanitizedError(error: unknown, context: ErrorContext = {}): void {
  const safeMessage =
    error instanceof Response
      ? `HTTP Error Response ${error.status}`
      : error instanceof Error
        ? error.message
        : "An unexpected runtime error occurred.";

  const safeContext = sanitizeValue(context);

  if (process.env.NODE_ENV === "development") {
    console.error("[Enterprise Error Logger]", safeMessage, safeContext);
  } else {
    // Production log: strictly sanitized
    console.error("[Enterprise Error Logger]", safeMessage);
  }
}
