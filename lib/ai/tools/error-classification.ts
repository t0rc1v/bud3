export type ErrorCategory = 'transient' | 'permission' | 'validation' | 'not_found' | 'unknown';

const TRANSIENT_PATTERNS = [
  /timeout/i, /timed?\s*out/i, /ETIMEDOUT/i, /ECONNRESET/i, /ECONNREFUSED/i,
  /network/i, /fetch failed/i, /socket hang up/i,
  /rate.?limit/i, /too many requests/i, /throttl/i,
  /\b502\b/, /\b503\b/, /\b504\b/, /\b429\b/,
  /temporarily unavailable/i, /service unavailable/i, /gateway/i,
];

const PERMISSION_PATTERNS = [
  /\b401\b/, /\b403\b/, /unauthorized/i, /forbidden/i, /not allowed/i, /access denied/i,
];

const VALIDATION_PATTERNS = [
  /invalid/i, /missing (required |mandatory )?field/i, /validation/i,
  /malformed/i, /bad request/i, /\b400\b/,
];

const NOT_FOUND_PATTERNS = [/\b404\b/, /not found/i, /does not exist/i, /no such/i];

export function classifyError(message: string): ErrorCategory {
  if (TRANSIENT_PATTERNS.some((p) => p.test(message))) return 'transient';
  if (PERMISSION_PATTERNS.some((p) => p.test(message))) return 'permission';
  if (VALIDATION_PATTERNS.some((p) => p.test(message))) return 'validation';
  if (NOT_FOUND_PATTERNS.some((p) => p.test(message))) return 'not_found';
  return 'unknown';
}
