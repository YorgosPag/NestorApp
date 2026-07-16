

/**
 * Current timestamp as ISO 8601 string.
 * Single source of truth for `new Date().toISOString()` — replaces every
 * scattered occurrence so we have ONE place to change if we ever need to
 * (a) inject a clock for tests, (b) switch to a monotonic source, or
 * (c) normalise timezone handling.
 *
 * @see ADR-314 Phase C.1
 */
export const nowISO = (): string => new Date().toISOString();

export function normalizeToDate(val: unknown): Date | null {
  if (!val) return null;
  // Firestore Timestamp (client or admin SDK) — both expose toDate()
  const timestampCandidate = val as { toDate?: () => Date };
  if (timestampCandidate && typeof timestampCandidate.toDate === 'function') return timestampCandidate.toDate();
  // JS Date
  if (val instanceof Date) return val;
  // A Timestamp that has been through JSON.stringify. The client SDK serialises
  // to { seconds, nanoseconds }; the Admin SDK has no toJSON() at all and its
  // private fields leak out as { _seconds, _nanoseconds }. Both arrive here as
  // plain objects with no methods, so they must be read structurally.
  const secondsCandidate = val as { seconds?: unknown; _seconds?: unknown };
  const seconds =
    typeof secondsCandidate.seconds === 'number'
      ? secondsCandidate.seconds
      : typeof secondsCandidate._seconds === 'number'
        ? secondsCandidate._seconds
        : null;
  if (seconds !== null) {
    const fromSeconds = new Date(seconds * 1000);
    return isNaN(fromSeconds.getTime()) ? null : fromSeconds;
  }
  // ISO string / epoch
  const d = new Date(val as string | number);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Timestamp / Date / string / number → ISO string, or null.
 * Single source of truth for Firestore timestamp → string conversion.
 * @see ADR-218
 */
export function normalizeToISO(val: unknown): string | null {
  const d = normalizeToDate(val);
  return d ? d.toISOString() : null;
}

/**
 * Extract a Firestore document field as ISO string.
 * Replaces scattered `getTimestampString()` / `toISOStringOrPassthrough()` helpers.
 * @see ADR-218
 */
export function fieldToISO(
  data: Record<string, unknown>,
  field: string,
  fallback?: string
): string {
  return normalizeToISO(data[field]) ?? (fallback ?? '');
}

/**
 * Extract timestamp from nested object path (e.g., "audit.createdAt").
 * Replaces `getNestedTimestamp()` in conversations/route.ts.
 * @see ADR-218
 */
/**
 * Timestamp / Date / string / number → epoch millis, or 0.
 * Replaces scattered `getTime()` / `resolveMillis()` helpers in sort comparators.
 * @see ADR-218 Phase 2
 */
export function normalizeToMillis(val: unknown): number {
  const d = normalizeToDate(val);
  return d ? d.getTime() : 0;
}

export function getNestedTimestampISO(data: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = data;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[part];
  }
  return normalizeToISO(current) ?? (typeof current === 'string' ? current : '');
}
