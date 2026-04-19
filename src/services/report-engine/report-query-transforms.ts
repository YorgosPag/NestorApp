/**
 * @module services/report-engine/report-query-transforms
 * @enterprise ADR-268 — Query Transform & Utility Helpers
 *
 * Shared utilities (getNestedValue, chunkArray) + Phase 5 transforms
 * (computed fields, row expansion, JS sort) for the Report Query Executor.
 * Extracted to keep report-query-executor.ts under 500 lines (Google SRP).
 */

import type { FieldDefinition } from '@/config/report-builder/report-builder-types';
import { chunkArray } from '@/lib/array-utils';

export { chunkArray };

// ============================================================================
// Shared Utilities
// ============================================================================

/**
 * Traverses a dot-path into a nested object.
 * Supports: nested objects, array indices (emails.0.email),
 * and persona resolver (persona.<type>.<field>).
 */
export function getNestedValue(obj: Record<string, unknown>, dotPath: string): unknown {
  // Persona resolver: persona.<type>.<field> → find matching persona in personas[]
  if (dotPath.startsWith('persona.')) {
    const [, personaType, ...fieldParts] = dotPath.split('.');
    const personas = obj['personas'];
    if (!Array.isArray(personas)) return undefined;
    const match = personas.find(
      (p: Record<string, unknown>) => p['personaType'] === personaType,
    );
    if (!match || !fieldParts.length) return undefined;
    return fieldParts.length === 1
      ? (match as Record<string, unknown>)[fieldParts[0]]
      : getNestedValue(match as Record<string, unknown>, fieldParts.join('.'));
  }

  const parts = dotPath.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    // Array index support: emails.0.email → emails[0].email
    if (Array.isArray(current) && /^\d+$/.test(part)) {
      current = (current as unknown[])[parseInt(part, 10)];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

// ============================================================================
// Computed Fields
// ============================================================================

/**
 * Applies computed field functions to each row after Firestore fetch.
 * Computed values are injected as top-level keys on the row object.
 */
export function applyComputedFields(
  rows: Record<string, unknown>[],
  fields: FieldDefinition[],
): Record<string, unknown>[] {
  const computedFields = fields.filter((f) => f.computed && f.computeFn);
  if (computedFields.length === 0) return rows;

  return rows.map((row) => {
    const augmented = { ...row };
    for (const field of computedFields) {
      augmented[field.key] = field.computeFn!(row);
    }
    return augmented;
  });
}

// ============================================================================
// Row Expansion (for detail-grain domains like C7b)
// ============================================================================

/**
 * Flattens an embedded array field: 1 Firestore doc → N result rows.
 * Each expanded row merges parent doc fields with array element fields.
 */
export function expandRows(
  rows: Record<string, unknown>[],
  expansionField: string,
): Record<string, unknown>[] {
  const expanded: Record<string, unknown>[] = [];

  for (const row of rows) {
    const arr = row[expansionField];
    if (!Array.isArray(arr) || arr.length === 0) {
      expanded.push(row);
      continue;
    }
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      expanded.push({
        ...row,
        ...(typeof item === 'object' && item !== null
          ? (item as Record<string, unknown>)
          : {}),
        _parentId: row['id'],
        _expansionIndex: i,
      });
    }
  }

  return expanded;
}

// ============================================================================
// JS Sort (for computed sort fields)
// ============================================================================

/**
 * Sorts rows in JavaScript when the sort field is computed (not in Firestore).
 * @param getNestedValue - Injected from executor to avoid circular dependency
 */
export function applySortInJs(
  rows: Record<string, unknown>[],
  sortField: string,
  sortDirection: 'asc' | 'desc',
  getNestedValue: (obj: Record<string, unknown>, path: string) => unknown,
): Record<string, unknown>[] {
  return [...rows].sort((a, b) => {
    const va = getNestedValue(a, sortField);
    const vb = getNestedValue(b, sortField);
    if (va === vb) return 0;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    const cmp = va < vb ? -1 : 1;
    return sortDirection === 'asc' ? cmp : -cmp;
  });
}
