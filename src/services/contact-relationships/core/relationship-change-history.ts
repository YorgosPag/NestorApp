// ============================================================================
// RELATIONSHIP CHANGE HISTORY — Builders for changeHistory[] entries (SSoT)
// ============================================================================
//
// Extracted from RelationshipCRUDService for SRP compliance and to centralize
// timestamp generation via nowISO() (ADR-314 Phase C).
//
// Each builder returns a fully-formed entry ready to append to
// ContactRelationship.changeHistory — preserving nowISO() as the single
// source of truth for wall-clock reads in relationship mutations.
//
// ============================================================================

import { dequal } from 'dequal';
import { nowISO } from '@/lib/date-local';
import type { ContactRelationship } from '@/types/contacts/relationships';

type ChangeHistoryEntry = NonNullable<ContactRelationship['changeHistory']>[number];

/**
 * Build 'updated' change history entry for relationship mutations.
 * `changedFields` is preserved as an extended property on the array element.
 */
export function buildUpdateChangeEntry(params: {
  changedBy: string;
  changedFields: string[];
  notes?: string;
}): ChangeHistoryEntry & { changedFields: string[] } {
  return {
    changeDate: nowISO(),
    changeType: 'updated',
    changedBy: params.changedBy,
    changedFields: params.changedFields,
    ...(params.notes ? { notes: params.notes } : {}),
  };
}

/**
 * Build 'status_change' entry for relationship termination via governed flow.
 */
export function buildTerminationChangeEntry(params: {
  changedBy: string;
}): ChangeHistoryEntry {
  return {
    changeDate: nowISO(),
    changeType: 'status_change',
    changedBy: params.changedBy,
    notes: 'Relationship terminated via governed UI flow',
  };
}

/** Bookkeeping keys a writer stamps on every save — never a change of the relationship. */
const BOOKKEEPING_FIELDS: ReadonlySet<string> = new Set(['lastModifiedBy', 'updatedAt', 'changeHistory']);

/** `null` / `undefined` / `''` / `[]` all mean «no value» — the form and the store spell it differently. */
function isAbsent(value: unknown): boolean {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

/**
 * **Which fields did this save ACTUALLY change?** (Salesforce Field History pattern.)
 * A form sends every field on every save; recording all of them made the history say
 * «10 fields changed» when two did, so the trail could not answer «what happened?».
 */
export function diffChangedFields<T extends object>(existing: T, updates: Partial<T>): string[] {
  const beforeRecord: Readonly<Record<string, unknown>> = { ...existing };
  const afterRecord: Readonly<Record<string, unknown>> = { ...updates };
  return Object.keys(afterRecord).filter((field) => {
    if (BOOKKEEPING_FIELDS.has(field)) return false;
    const before = beforeRecord[field];
    const after = afterRecord[field];
    if (isAbsent(before) && isAbsent(after)) return false;
    return !dequal(before, after);
  });
}
