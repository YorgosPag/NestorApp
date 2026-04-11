/**
 * =============================================================================
 * CDC AUDIT: Generic Deep Field Diff
 * =============================================================================
 *
 * Computes a flat, dot-notation list of field changes between two Firestore
 * document snapshots. Unlike the service-layer audit diff, this never relies
 * on a manually-maintained field allowlist — it diffs every field in the
 * document, minus the ignored set. This is the Google-native pattern: the
 * database tells you what changed, you don't maintain a parallel list.
 *
 * Design:
 *   - `flatten()` walks nested plain objects, producing `parent.child` keys.
 *     Arrays and Firestore Timestamps are treated as leaf values (serialized
 *     to a stable JSON string for comparison).
 *   - `serialize()` normalises values so `null`, `undefined`, and `''` all
 *     compare equal (same policy as entity-audit.service.ts).
 *   - Keys present in only one side still produce a change (add/remove).
 *
 * @module functions/audit/deep-diff
 * @enterprise ADR-195 — Entity Audit Trail (Phase 1 CDC PoC)
 */

import { isIgnoredField } from './ignored-fields';

export interface FieldChange {
  field: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
  label: string;
}

type Primitive = string | number | boolean | null;

function isPrimitive(v: unknown): v is Primitive {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v);
}

/**
 * Treat Firestore Timestamp-like objects as leaves. Admin SDK Timestamps
 * expose `_seconds` / `_nanoseconds`; the REST shape exposes `seconds`.
 */
function isTimestampLike(v: Record<string, unknown>): boolean {
  return '_seconds' in v || ('seconds' in v && 'nanoseconds' in v);
}

function flatten(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !isTimestampLike(value as Record<string, unknown>)
    ) {
      Object.assign(out, flatten(value as Record<string, unknown>, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function serialize(value: unknown): Primitive {
  if (value === null || value === undefined || value === '') return null;
  if (isPrimitive(value)) return value;
  return JSON.stringify(sortKeys(value));
}

/**
 * Produce a stable, sorted list of field changes between `before` and `after`.
 * Empty array means the two snapshots are equivalent after ignoring system
 * fields and normalising null-ish values.
 */
export function deepDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldChange[] {
  const flatBefore = flatten(before);
  const flatAfter = flatten(after);

  const keys = new Set<string>([
    ...Object.keys(flatBefore),
    ...Object.keys(flatAfter),
  ]);

  const changes: FieldChange[] = [];
  for (const key of keys) {
    if (isIgnoredField(key)) continue;
    const oldValue = serialize(flatBefore[key]);
    const newValue = serialize(flatAfter[key]);
    if (oldValue !== newValue) {
      changes.push({ field: key, oldValue, newValue, label: key });
    }
  }

  changes.sort((a, b) => a.field.localeCompare(b.field));
  return changes;
}
