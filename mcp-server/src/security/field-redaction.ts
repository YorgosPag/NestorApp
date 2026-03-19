/**
 * Sensitive Field Redaction
 *
 * Automatically strips sensitive fields from Firestore document data
 * before returning to Claude. Prevents credential leakage.
 */

// ============================================================================
// SENSITIVE FIELD PATTERNS
// ============================================================================

const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'token',
  'apiKey',
  'secret',
  'refreshToken',
  'accessToken',
  'privateKey',
  'webhookSecret',
  'signingKey',
  'encryptionKey',
  'serviceAccountKey',
  'credentials',
]);

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token$/i,
  /apikey/i,
  /private.?key/i,
  /signing.?key/i,
];

// ============================================================================
// REDACTION
// ============================================================================

function isSensitiveField(fieldName: string): boolean {
  if (SENSITIVE_FIELDS.has(fieldName)) return true;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(fieldName));
}

/**
 * Recursively redact sensitive fields from a document.
 * Returns a new object — does not mutate the original.
 */
export function redactSensitiveFields(
  data: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveField(key)) {
      result[key] = '[REDACTED]';
      continue;
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactSensitiveFields(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object' && !Array.isArray(item)
          ? redactSensitiveFields(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}
