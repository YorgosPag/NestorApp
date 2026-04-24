/**
 * 📜 Audit Diff — Shared Primitive (SSoT)
 *
 * Single source of truth for field-level diffing used by:
 *  - `EntityAuditService.diffFields()` (server, Firebase Admin SDK)
 *  - `computeEntityDiff()` in `audit-tracked-fields.ts` (client)
 *
 * Both paths previously maintained duplicate copies of `sortKeys` /
 * `serializeValue` / diff logic. This module consolidates them so any
 * behavior change (e.g. future collection-aware diffing) lands once.
 *
 * Empty structures ([], {all-empty-strings}) are normalized to `null`
 * so that `null → []` or `null → { facebook: '' }` do NOT produce audit
 * noise from form-initialization defaults.
 *
 * @module lib/audit/audit-diff
 * @enterprise ADR-195 — Entity Audit Trail
 */

import type { AuditFieldChange, AuditSubChange } from '@/types/audit-trail';

// ============================================================================
// TRACKED FIELD DEFINITION (ADR-195 Phase 11 — SSoT discriminated union)
// ============================================================================

/**
 * Schema for one tracked field. The `kind` discriminator routes the diff
 * engine between scalar comparison and collection-aware reconciliation.
 *
 * - `scalar` — single primitive (string/number/bool/null) or opaque object.
 *   Produces `oldValue → newValue` entries (legacy behavior).
 * - `collection` — array of items. The diff engine reconciles by `keyBy`
 *   and produces granular added/removed/modified entries.
 *
 * As of this commit, ALL fields are declared `scalar`. Array fields will be
 * flipped to `collection` together with the engine that understands them.
 */
export type TrackedFieldDef =
  | { readonly kind: 'scalar'; readonly label: string }
  | {
      readonly kind: 'collection';
      readonly label: string;
      /**
       * Stable identity for collection items.
       * - `'value'` — the element itself is the key (primitive arrays).
       * - `string` — read this property from each item (e.g. `'id'`).
       * - `readonly string[]` — composite key, joined by `|`.
       */
      readonly keyBy: 'value' | string | readonly string[];
      /** Item fields concatenated to form the human display label. */
      readonly labelFields?: readonly string[];
      /** Separator between `labelFields` (default `' — '`). */
      readonly labelSeparator?: string;
      /** Sub-fields tracked for `op === 'modified'` entries. */
      readonly trackSubFields?: readonly string[];
      /** Optional human-readable label overrides per sub-field (used instead of i18n fallback). */
      readonly subFieldLabels?: Readonly<Record<string, string>>;
    };

/**
 * Convert a `TrackedFieldDef` map back to a plain `Record<string, string>`
 * (field → label). Used internally so the legacy flatten/diff helpers keep
 * a single signature.
 */
export function legacyLabelMap(
  defs: Record<string, TrackedFieldDef>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, def] of Object.entries(defs)) {
    out[field] = def.label;
  }
  return out;
}

// ============================================================================
// FLATTENING — Dot-notation support for nested tracked fields
// ============================================================================

/**
 * Flatten a document for dot-notation tracking.
 * Converts `{ commercial: { askingPrice: 100 } }` → `{ 'commercial.askingPrice': 100 }`
 *
 * Only flattens keys that have a corresponding dot-notation entry in `trackedFields`.
 * Top-level tracked keys pass through untouched.
 */
export function flattenForTracking(
  doc: Record<string, unknown>,
  trackedFields: Record<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const nestedPrefixes = new Set<string>();
  for (const field of Object.keys(trackedFields)) {
    const dotIdx = field.indexOf('.');
    if (dotIdx > 0) {
      nestedPrefixes.add(field.slice(0, dotIdx));
    }
  }

  for (const [key, value] of Object.entries(doc)) {
    if (
      nestedPrefixes.has(key) &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        const dotKey = `${key}.${subKey}`;
        if (dotKey in trackedFields) {
          result[dotKey] = subValue;
        }
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ============================================================================
// PRIMITIVES
// ============================================================================

/**
 * Recursively sort object keys so two structurally-equal objects serialize
 * to the same string regardless of key insertion order.
 */
export function sortKeys(value: unknown): unknown {
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

/**
 * Serialize a value to a comparable primitive for diffing.
 *
 * Normalizations (all return `null`):
 *   - `null`, `undefined`, `''`
 *   - empty arrays `[]`
 *   - objects where every value is null/undefined/''
 *
 * These match form-initialization defaults and would otherwise produce
 * noisy audit entries (e.g. `null → { facebook: '', twitter: '' }`).
 */
export function serializeScalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value) && value.length === 0) return null;
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const vals = Object.values(value as Record<string, unknown>);
    if (vals.length === 0) return null;
    if (vals.every((v) => v === null || v === undefined || v === '')) return null;
  }
  return JSON.stringify(sortKeys(value));
}

// ============================================================================
// LEGACY DIFF (Record<string, string> signature — current consumers)
// ============================================================================

/**
 * Compute field-level diffs between old and new document states.
 *
 * Supports dot-notation fields (e.g. `commercial.askingPrice`) via
 * `flattenForTracking`. Only fields present in `newDoc` are considered,
 * so partial update payloads don't produce false negatives for fields
 * the caller never touched.
 *
 * This is the **legacy** signature that accepts a plain label map. A
 * discriminated-union variant will be added in a follow-up commit for
 * collection-aware diffing.
 */
export function diffTrackedFieldsLegacy(
  oldDoc: Record<string, unknown>,
  newDoc: Record<string, unknown>,
  trackedFields: Record<string, string>,
): AuditFieldChange[] {
  const flatOld = flattenForTracking(oldDoc, trackedFields);
  const flatNew = flattenForTracking(newDoc, trackedFields);

  const changes: AuditFieldChange[] = [];

  for (const [field, label] of Object.entries(trackedFields)) {
    if (!(field in flatNew)) continue;

    const oldValue = flatOld[field] ?? null;
    const newValue = flatNew[field] ?? null;

    const oldStr = serializeScalar(oldValue);
    const newStr = serializeScalar(newValue);

    if (oldStr !== newStr) {
      changes.push({ field, oldValue: oldStr, newValue: newStr, label });
    }
  }

  return changes;
}

// ============================================================================
// COLLECTION DIFF (ADR-195 Phase 11 — key-based reconciliation)
// ============================================================================

/** Narrow shape for the collection variant of `TrackedFieldDef`. */
type CollectionDef = Extract<TrackedFieldDef, { kind: 'collection' }>;

/** Coerce any value to an array (null/undefined/non-array → []). */
function normalizeArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Derive a stable identity key for one collection item.
 *
 * Priority:
 *   1. `keyBy: 'value'` — primitive element is its own key.
 *   2. `keyBy: string` — read that property.
 *   3. `keyBy: string[]` — composite from all listed properties.
 * When the primary strategy yields no usable value (missing id / all-empty
 * composite), we fall back to a deterministic JSON of the whole item. This
 * keeps "added / removed" semantics correct even for legacy rows without
 * stable ids (at the cost of modifications presenting as remove+add).
 */
function computeKey(
  item: unknown,
  keyBy: 'value' | string | readonly string[],
): string {
  if (keyBy === 'value') {
    if (item === null || item === undefined) return '__null__';
    if (typeof item === 'string') return `s:${item}`;
    if (typeof item === 'number' || typeof item === 'boolean') return `p:${String(item)}`;
    return `j:${JSON.stringify(sortKeys(item))}`;
  }
  if (typeof item !== 'object' || item === null) {
    return `j:${JSON.stringify(item)}`;
  }
  const rec = item as Record<string, unknown>;
  if (typeof keyBy === 'string') {
    const v = rec[keyBy];
    if (v !== undefined && v !== null && v !== '') return `k:${String(v)}`;
    return `j:${JSON.stringify(sortKeys(rec))}`;
  }
  const parts: string[] = [];
  for (const field of keyBy) {
    const v = rec[field];
    parts.push(v === undefined || v === null ? '' : String(v));
  }
  if (parts.every((p) => p === '')) {
    return `j:${JSON.stringify(sortKeys(rec))}`;
  }
  return `c:${parts.join('|')}`;
}

/** Build a `key → item` index preserving the LAST occurrence on duplicates. */
function indexByKey(
  items: readonly unknown[],
  keyBy: 'value' | string | readonly string[],
): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const item of items) {
    map.set(computeKey(item, keyBy), item);
  }
  return map;
}

/**
 * Produce a human display label for a collection item by concatenating
 * `labelFields`. Primitive items return themselves as a string. Falls back
 * to the first non-empty string/number property when `labelFields` is
 * unhelpful.
 */
function formatItemLabel(
  item: unknown,
  labelFields: readonly string[] | undefined,
  separator: string | undefined,
): string {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'number' || typeof item === 'boolean') return String(item);
  if (typeof item !== 'object') return '';
  const rec = item as Record<string, unknown>;
  const sep = separator ?? ' — ';
  if (labelFields && labelFields.length > 0) {
    const parts: string[] = [];
    for (const field of labelFields) {
      const v = rec[field];
      if (v !== undefined && v !== null && v !== '') parts.push(String(v));
    }
    if (parts.length > 0) return parts.join(sep);
  }
  for (const v of Object.values(rec)) {
    if (typeof v === 'string' && v !== '') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

/**
 * Build the set of field names that form the item's identity so we can
 * exclude them from sub-field diffs (no point reporting `id → id`).
 */
function keyFieldSet(keyBy: 'value' | string | readonly string[]): ReadonlySet<string> {
  if (keyBy === 'value') return new Set();
  if (typeof keyBy === 'string') return new Set([keyBy]);
  return new Set(keyBy);
}

/**
 * Compute sub-field changes between two collection items matched by key.
 * Respects `trackSubFields` when provided; otherwise inspects the union of
 * keys from both items. Primitives (e.g. `string[]` items) yield no
 * sub-changes.
 */
function diffSubFields(
  before: unknown,
  after: unknown,
  keyBy: 'value' | string | readonly string[],
  trackSubFields: readonly string[] | undefined,
  subFieldLabels?: Readonly<Record<string, string>>,
): AuditSubChange[] {
  if (
    typeof before !== 'object' || before === null || Array.isArray(before) ||
    typeof after !== 'object' || after === null || Array.isArray(after)
  ) {
    return [];
  }
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const skip = keyFieldSet(keyBy);
  const fields: readonly string[] = trackSubFields
    ? trackSubFields
    : Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));

  const subs: AuditSubChange[] = [];
  for (const field of fields) {
    if (skip.has(field)) continue;
    const oldValue = serializeScalar(b[field]);
    const newValue = serializeScalar(a[field]);
    if (oldValue !== newValue) {
      const label = subFieldLabels?.[field];
      subs.push({ subField: field, oldValue, newValue, ...(label ? { label } : {}) });
    }
  }
  return subs;
}

/**
 * Reconcile two arrays by stable key and emit granular audit entries.
 * Produces one `AuditFieldChange` per added / removed / modified item,
 * with `kind: 'collection'`, the resolved `itemKey`, a human `itemLabel`
 * and (for modifications) a `subChanges` array.
 */
function diffCollection(
  field: string,
  def: CollectionDef,
  before: readonly unknown[],
  after: readonly unknown[],
): AuditFieldChange[] {
  const beforeMap = indexByKey(before, def.keyBy);
  const afterMap = indexByKey(after, def.keyBy);
  const out: AuditFieldChange[] = [];

  for (const [key, item] of afterMap) {
    if (beforeMap.has(key)) continue;
    out.push({
      field,
      oldValue: null,
      newValue: null,
      label: def.label,
      kind: 'collection',
      op: 'added',
      itemKey: key,
      itemLabel: formatItemLabel(item, def.labelFields, def.labelSeparator),
      subChanges: diffSubFields({}, item, def.keyBy, def.trackSubFields, def.subFieldLabels),
    });
  }

  for (const [key, item] of beforeMap) {
    if (afterMap.has(key)) continue;
    out.push({
      field,
      oldValue: null,
      newValue: null,
      label: def.label,
      kind: 'collection',
      op: 'removed',
      itemKey: key,
      itemLabel: formatItemLabel(item, def.labelFields, def.labelSeparator),
      subChanges: diffSubFields(item, {}, def.keyBy, def.trackSubFields, def.subFieldLabels),
    });
  }

  for (const [key, afterItem] of afterMap) {
    const beforeItem = beforeMap.get(key);
    if (beforeItem === undefined) continue;
    const subChanges = diffSubFields(beforeItem, afterItem, def.keyBy, def.trackSubFields, def.subFieldLabels);
    if (subChanges.length === 0) continue;
    out.push({
      field,
      oldValue: null,
      newValue: null,
      label: def.label,
      kind: 'collection',
      op: 'modified',
      itemKey: key,
      itemLabel: formatItemLabel(afterItem, def.labelFields, def.labelSeparator),
      subChanges,
    });
  }

  return out;
}

// ============================================================================
// CANONICAL DIFF (TrackedFieldDef signature — preferred entry point)
// ============================================================================

/**
 * Compute field-level diffs between two document states using the SSoT
 * `TrackedFieldDef` registry. Canonical entry point for all audit diffing.
 *
 * Routing:
 *   - `kind: 'scalar'` → primitive before/after comparison (legacy behavior).
 *   - `kind: 'collection'` → key-based reconciliation via `diffCollection`
 *     emitting granular added / removed / modified entries.
 *
 * Partial-update semantics: only fields present in `newDoc` are evaluated,
 * so PATCH payloads that touch a subset of fields don't produce false
 * negatives for untouched ones. Dot-notation flattening (e.g.
 * `commercial.owners`) works for both scalar and collection variants.
 */
export function diffTrackedFields(
  oldDoc: Record<string, unknown>,
  newDoc: Record<string, unknown>,
  defs: Record<string, TrackedFieldDef>,
): AuditFieldChange[] {
  const labels = legacyLabelMap(defs);
  const flatOld = flattenForTracking(oldDoc, labels);
  const flatNew = flattenForTracking(newDoc, labels);

  const changes: AuditFieldChange[] = [];

  for (const [field, def] of Object.entries(defs)) {
    if (!(field in flatNew)) continue;

    if (def.kind === 'collection') {
      const before = normalizeArray(flatOld[field]);
      const after = normalizeArray(flatNew[field]);
      changes.push(...diffCollection(field, def, before, after));
      continue;
    }

    const oldValue = flatOld[field] ?? null;
    const newValue = flatNew[field] ?? null;
    const oldStr = serializeScalar(oldValue);
    const newStr = serializeScalar(newValue);
    if (oldStr !== newStr) {
      changes.push({ field, oldValue: oldStr, newValue: newStr, label: def.label });
    }
  }

  return changes;
}
