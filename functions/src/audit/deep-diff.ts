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
 *   - ADR-195 (η): an optional {@link CdcDiffSchema} supplies the DECLARED
 *     item identity of array fields and the derived-mirror pairs. What it
 *     does not declare keeps the best-effort heuristic below.
 *
 * @module functions/audit/deep-diff
 * @enterprise ADR-195 — Entity Audit Trail (Phase 1 CDC PoC)
 */

import { isIgnoredField } from './ignored-fields';
import { sortKeysDeep } from '../generated/lib/sort-keys-deep';
import {
  collectionItemLabel,
  computeCollectionItemKey,
  itemFieldUnion,
  itemRecordPair,
  scalarItemLabel,
  type CollectionIdentity,
} from '../generated/lib/audit/collection-item-identity';

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
  /** Stable identity of the collection item (resolved by {@link ItemRule}). */
  itemKey?: string;
  /** Human display label for the collection item. */
  itemLabel?: string;
  /** Granular sub-field changes for `op === 'modified'`. */
  subChanges?: SubChange[];
}

/**
 * ADR-195 (η) — what the collection being audited DECLARES about itself.
 * Built from the app SSoT (`config/audit-collection-identity.ts`, projected
 * by CHECK 3.93), never written by hand in this package.
 */
export interface CdcDiffSchema {
  /** `field path → item identity`. Undeclared array fields use the heuristic. */
  readonly collections?: Readonly<Record<string, CollectionIdentity>>;
  /**
   * `derived field → authoritative field`. A derived change is dropped ONLY
   * when its authority changed in the same write; a derived field that
   * changed alone is a mirror drift and stays visible.
   */
  readonly derivedMirrors?: Readonly<Record<string, string | undefined>>;
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

function serialize(value: unknown): Primitive {
  if (value === null || value === undefined || value === '') return null;
  if (isPrimitive(value)) return value;
  return JSON.stringify(sortKeysDeep(value));
}

// ============================================================================
// COLLECTION-AWARE DIFF (ADR-195 Phase 11 · (η))
// ============================================================================
//
// Declared identity first (the same `keyBy` / `labelFields` the service-layer
// registry uses — ONE declaration, ONE algorithm). For arrays nobody declared
// we keep the best-effort heuristic: `id` / `contactId` / `uid` / `key` when
// present, composite-of-primitives otherwise, full-JSON as a last resort.
// ⚠️ The heuristic puts EVERY primitive in the key, so a change of one item
// property (`type: mobile → main`) changes the key and reads as remove + add.
// That is exactly why contact collections are declared.

const STABLE_ID_FIELDS = ['id', 'contactId', 'uid', 'key'] as const;

const LABEL_FIELD_PRIORITY = [
  'name', 'displayName', 'label', 'title',
  'street', 'email', 'number', 'url',
  'type', 'platform', 'username',
] as const;

/** How one array field identifies and names its items. */
interface ItemRule {
  key(item: unknown, index: number): string;
  label(item: unknown): string;
}

/** Heuristic identity: explicit id fields → composite-of-primitives → JSON. */
function heuristicItemKey(item: unknown, index: number): string {
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
  return `j:${JSON.stringify(sortKeysDeep(rec))}`;
}

/** Heuristic label from the first two meaningful primitives. */
function heuristicItemLabel(item: unknown): string {
  const scalar = scalarItemLabel(item);
  if (scalar !== undefined) return scalar;
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

const HEURISTIC_RULE: ItemRule = { key: heuristicItemKey, label: heuristicItemLabel };

/** Own-property lookup: a document field named `constructor` must not find `Object.prototype.constructor`. */
function ownValue<T>(map: Readonly<Record<string, T>> | undefined, key: string): T | undefined {
  return map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}

function itemRuleFor(identity: CollectionIdentity | undefined): ItemRule {
  if (!identity) return HEURISTIC_RULE;
  return {
    key: (item) => computeCollectionItemKey(item, identity.keyBy),
    label: (item) => collectionItemLabel(item, identity.labelFields, identity.labelSeparator),
  };
}

/** Sub-field diff for two collection items matched by key. Primitives → []. */
function diffItemSubFields(before: unknown, after: unknown): SubChange[] {
  const pair = itemRecordPair(before, after);
  if (!pair) return [];
  const [b, a] = pair;
  const subs: SubChange[] = [];
  for (const field of itemFieldUnion(b, a)) {
    const oldValue = serialize(b[field]);
    const newValue = serialize(a[field]);
    if (oldValue !== newValue) {
      subs.push({ subField: field, oldValue, newValue });
    }
  }
  return subs;
}

function collectionChange(
  field: string,
  op: CollectionOp,
  itemKey: string,
  itemLabel: string,
  subChanges?: SubChange[],
): FieldChange {
  return {
    field,
    oldValue: null,
    newValue: null,
    label: field,
    kind: 'collection',
    op,
    itemKey,
    itemLabel,
    ...(subChanges ? { subChanges } : {}),
  };
}

/**
 * Reconcile two arrays by item key and emit per-item FieldChange entries.
 * Used when {@link deepDiff} encounters a field whose value is an array on
 * either side.
 */
function diffArrayField(
  field: string,
  before: readonly unknown[],
  after: readonly unknown[],
  rule: ItemRule,
): FieldChange[] {
  const beforeMap = new Map<string, unknown>();
  const afterMap = new Map<string, unknown>();
  before.forEach((item, i) => beforeMap.set(rule.key(item, i), item));
  after.forEach((item, i) => afterMap.set(rule.key(item, i), item));

  const out: FieldChange[] = [];
  for (const [key, item] of afterMap) {
    if (!beforeMap.has(key)) out.push(collectionChange(field, 'added', key, rule.label(item)));
  }
  for (const [key, item] of beforeMap) {
    if (!afterMap.has(key)) out.push(collectionChange(field, 'removed', key, rule.label(item)));
  }
  for (const [key, afterItem] of afterMap) {
    if (!beforeMap.has(key)) continue;
    const subChanges = diffItemSubFields(beforeMap.get(key), afterItem);
    if (subChanges.length === 0) continue;
    out.push(collectionChange(field, 'modified', key, rule.label(afterItem), subChanges));
  }
  return out;
}

/** Drop a derived mirror's changes when its authority changed in the same write. */
function dropMirroredDerived(
  changes: readonly FieldChange[],
  derivedMirrors: CdcDiffSchema['derivedMirrors'],
): FieldChange[] {
  if (!derivedMirrors) return [...changes];
  const changedFields = new Set(changes.map((c) => c.field));
  return changes.filter((c) => {
    const authority = ownValue(derivedMirrors, c.field);
    return !(authority && changedFields.has(authority));
  });
}

const OP_RANK: Readonly<Record<CollectionOp, number>> = { removed: 0, added: 1, modified: 2 };

function byFieldThenOp(a: FieldChange, b: FieldChange): number {
  const byField = a.field.localeCompare(b.field);
  if (byField !== 0) return byField;
  // Stable secondary ordering: removed → added → modified → scalar
  return (a.op ? OP_RANK[a.op] : 3) - (b.op ? OP_RANK[b.op] : 3);
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
  schema: CdcDiffSchema = {},
): FieldChange[] {
  const flatBefore = flatten(before);
  const flatAfter = flatten(after);
  const keys = new Set<string>([...Object.keys(flatBefore), ...Object.keys(flatAfter)]);

  const changes: FieldChange[] = [];
  for (const key of keys) {
    if (isIgnoredField(key)) continue;

    const oldRaw = flatBefore[key];
    const newRaw = flatAfter[key];

    // ── Array → collection-aware diff ──
    if (Array.isArray(oldRaw) || Array.isArray(newRaw)) {
      const beforeArr = Array.isArray(oldRaw) ? oldRaw : [];
      const afterArr = Array.isArray(newRaw) ? newRaw : [];
      const rule = itemRuleFor(ownValue(schema.collections, key));
      changes.push(...diffArrayField(key, beforeArr, afterArr, rule));
      continue;
    }

    // ── Scalar comparison (legacy path) ──
    const oldValue = serialize(oldRaw);
    const newValue = serialize(newRaw);
    if (oldValue !== newValue) {
      changes.push({ field: key, oldValue, newValue, label: key });
    }
  }

  return dropMirroredDerived(changes, schema.derivedMirrors).sort(byFieldThenOp);
}
