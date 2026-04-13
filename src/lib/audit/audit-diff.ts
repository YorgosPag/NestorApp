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

import type { AuditFieldChange } from '@/types/audit-trail';

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
