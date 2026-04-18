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
