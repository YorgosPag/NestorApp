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

/**
 * Collection operation kind (ADR-195 Phase 11).
 * Emitted by {@link deepDiff} when an array field changes — one entry per
 * added/removed/modified item, matching the shape used by the service-layer
 * SSoT so the UI renders both CDC and API-path audit trails uniformly.
 */
export type CollectionOp = 'added' | 'removed' | 'modified';

export interface SubChange {
  subField: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
}

export interface FieldChange {
  field: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
  label: string;
  // ── Collection-aware extension (ADR-195 Phase 11) ──
  /** Discriminator. Omitted = scalar (legacy). */
  kind?: 'scalar' | 'collection';
  /** Operation kind for collection items. */
  op?: CollectionOp;
  /** Stable identity of the collection item (resolved by {@link deriveItemKey}). */
  itemKey?: string;
  /** Human display label for the collection item. */
  itemLabel?: string;
  /** Granular sub-field changes for `op === 'modified'`. */
  subChanges?: SubChange[];
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

// ============================================================================
// COLLECTION-AWARE DIFF (ADR-195 Phase 11)
// ============================================================================
//
// The service-layer diff (src/lib/audit/audit-diff.ts) consults an SSoT
// TrackedFieldDef registry to know which fields are collections and how to
// key them. CDC triggers don't have that registry — they observe raw
// Firestore snapshots. Instead we auto-detect arrays in `deepDiff` and
// reconcile them by best-effort stable key: `id` / `contactId` / `uid` /
// `key` when present, composite-of-primitives otherwise, full-JSON as a
// last resort. The emitted `FieldChange` shape matches the service-layer
// schema exactly so the UI renderer is oblivious to which writer produced
// the entry.

const STABLE_ID_FIELDS = ['id', 'contactId', 'uid', 'key'] as const;

const LABEL_FIELD_PRIORITY = [
  'name', 'displayName', 'label', 'title',
  'street', 'email', 'number', 'url',
  'type', 'platform', 'username',
] as const;

/**
 * Derive a stable identity key for one collection item.
 * Priority: explicit id fields → composite-of-primitives → JSON fallback.
 */
function deriveItemKey(item: unknown, index: number): string {
  if (item === null || item === undefined) return `__null_${index}`;
  if (typeof item === 'string') return `s:${item}`;
  if (typeof item === 'number' || typeof item === 'boolean') return `p:${String(item)}`;
  if (typeof item !== 'object') return `j:${JSON.stringify(item)}`;

  const rec = item as Record<string, unknown>;
  for (const field of STABLE_ID_FIELDS) {
    const v = rec[field];
    if (typeof v === 'string' && v !== '') return `k:${v}`;
    if (typeof v === 'number') return `k:${v}`;
  }
  const parts: string[] = [];
  for (const [k, v] of Object.entries(rec)) {
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      parts.push(`${k}=${String(v)}`);
    }
  }
  if (parts.length > 0) return `c:${parts.sort().join('|')}`;
  return `j:${JSON.stringify(sortKeys(rec))}`;
}

/** Build a best-effort human label from the first two meaningful primitives. */
function deriveItemLabel(item: unknown): string {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'number' || typeof item === 'boolean') return String(item);
  if (typeof item !== 'object') return '';
  const rec = item as Record<string, unknown>;
  const parts: string[] = [];
  for (const field of LABEL_FIELD_PRIORITY) {
    const v = rec[field];
    if (typeof v === 'string' && v !== '') parts.push(v);
    else if (typeof v === 'number' && Number.isFinite(v)) parts.push(String(v));
    if (parts.length >= 2) break;
  }
  return parts.join(' — ');
}

/** Sub-field diff for two collection items matched by key. Primitives → []. */
function diffItemSubFields(before: unknown, after: unknown): SubChange[] {
  if (
    typeof before !== 'object' || before === null || Array.isArray(before) ||
    typeof after !== 'object' || after === null || Array.isArray(after)
  ) {
    return [];
  }
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const fields = new Set([...Object.keys(b), ...Object.keys(a)]);
  const subs: SubChange[] = [];
  for (const field of fields) {
    const oldValue = serialize(b[field]);
    const newValue = serialize(a[field]);
    if (oldValue !== newValue) {
      subs.push({ subField: field, oldValue, newValue });
    }
  }
  return subs;
}

/**
 * Reconcile two arrays by derived key and emit per-item FieldChange entries.
 * Used when {@link deepDiff} encounters a field whose value is an array on
 * either side.
 */
function diffArrayField(
  field: string,
  before: readonly unknown[],
  after: readonly unknown[],
): FieldChange[] {
  const beforeMap = new Map<string, unknown>();
  const afterMap = new Map<string, unknown>();
  before.forEach((item, i) => beforeMap.set(deriveItemKey(item, i), item));
  after.forEach((item, i) => afterMap.set(deriveItemKey(item, i), item));

  const out: FieldChange[] = [];

  for (const [key, item] of afterMap) {
    if (beforeMap.has(key)) continue;
    out.push({
      field,
      oldValue: null,
      newValue: null,
      label: field,
      kind: 'collection',
      op: 'added',
      itemKey: key,
      itemLabel: deriveItemLabel(item),
    });
  }

  for (const [key, item] of beforeMap) {
    if (afterMap.has(key)) continue;
    out.push({
      field,
      oldValue: null,
      newValue: null,
      label: field,
      kind: 'collection',
      op: 'removed',
      itemKey: key,
      itemLabel: deriveItemLabel(item),
    });
  }

  for (const [key, afterItem] of afterMap) {
    const beforeItem = beforeMap.get(key);
    if (beforeItem === undefined) continue;
    const subChanges = diffItemSubFields(beforeItem, afterItem);
    if (subChanges.length === 0) continue;
    out.push({
      field,
      oldValue: null,
      newValue: null,
      label: field,
      kind: 'collection',
      op: 'modified',
      itemKey: key,
      itemLabel: deriveItemLabel(afterItem),
      subChanges,
    });
  }

  return out;
}

/**
 * Produce a stable, sorted list of field changes between `before` and `after`.
 * Empty array means the two snapshots are equivalent after ignoring system
 * fields and normalising null-ish values.
 *
 * Array fields (top-level or nested via dot-notation) are diffed via
 * {@link diffArrayField}, producing one collection-aware entry per
 * added/removed/modified item. All other fields go through the scalar path.
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

    const oldRaw = flatBefore[key];
    const newRaw = flatAfter[key];

    // ── Array → collection-aware diff ──
    if (Array.isArray(oldRaw) || Array.isArray(newRaw)) {
      const beforeArr = Array.isArray(oldRaw) ? oldRaw : [];
      const afterArr = Array.isArray(newRaw) ? newRaw : [];
      changes.push(...diffArrayField(key, beforeArr, afterArr));
      continue;
    }

    // ── Scalar comparison (legacy path) ──
    const oldValue = serialize(oldRaw);
    const newValue = serialize(newRaw);
    if (oldValue !== newValue) {
      changes.push({ field: key, oldValue, newValue, label: key });
    }
  }

  changes.sort((a, b) => {
    const byField = a.field.localeCompare(b.field);
    if (byField !== 0) return byField;
    // Stable secondary ordering: removed → added → modified
    const opRank = (op?: CollectionOp) =>
      op === 'removed' ? 0 : op === 'added' ? 1 : op === 'modified' ? 2 : 3;
    return opRank(a.op) - opRank(b.op);
  });
  return changes;
}
