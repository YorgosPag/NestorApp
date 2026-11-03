/**
 * @fileoverview **Τι σημαίνει μια άρνηση του γραφέα της υπεργολαβίας, για την οθόνη** (ADR-928 §5.14 · Φ3α-2).
 * @related subapps/procurement/subcontracts/schema/subcontract-write-kinds.ts (τα είδη — ο ίδιος πίνακας με τον
 *   διακομιστή) · lib/api/writer-refusal.ts (η κοινή ερμηνεία, ίδια με του καταλόγου)
 * @module services/procurement/subcontracts/subcontract-failure
 *
 * 🔑 Ρητή ένωση: «άλλαξε από άλλον» (409 CAS, με την τρέχουσα αναθεώρηση) · «ευρήματα» (422, κωδικοί + διαδρομές) ·
 *    άρνηση κύκλου ζωής (`deviationsPending` · `offerExpired` · …) · «δεν επιτρέπεται» · «δίκτυο».
 * ⚠️ Κάθε εύρημα ελέγχεται απέναντι στο `SUBCONTRACT_ISSUE_CODES` πριν γίνει δεκτό — το σώμα έρχεται από το δίκτυο.
 */

import { currentRevisionOf, TRANSPORT_REFUSAL_KINDS, writerRefusalOf } from '@/lib/api/writer-refusal';
import {
  SUBCONTRACT_ISSUE_CODES,
  type SubcontractIssue,
  type SubcontractIssueCode,
} from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import {
  SUBCONTRACT_ERROR_CODE_PREFIX,
  SUBCONTRACT_WRITE_ERROR_KIND_NAMES,
  type SubcontractWriteErrorKind,
} from '@/subapps/procurement/subcontracts/schema/subcontract-write-kinds';

export const SUBCONTRACT_FAILURE_KINDS = [...SUBCONTRACT_WRITE_ERROR_KIND_NAMES, ...TRANSPORT_REFUSAL_KINDS] as const;
export type SubcontractFailureKind = (typeof SUBCONTRACT_FAILURE_KINDS)[number];

export interface SubcontractFailure {
  readonly kind: SubcontractFailureKind;
  readonly issues: readonly SubcontractIssue[];
  /** Μόνο στο `revisionMismatch`: η αναθεώρηση που έχει **τώρα** ο διακομιστής. */
  readonly currentRevision: number | null;
}

function isIssueCode(value: unknown): value is SubcontractIssueCode {
  return (SUBCONTRACT_ISSUE_CODES as readonly unknown[]).includes(value);
}

function issueOf(raw: Readonly<Record<string, unknown>>): SubcontractIssue | null {
  const { code, path } = raw;
  return isIssueCode(code) && typeof path === 'string' ? { code, path } : null;
}

const SUBCONTRACT_REFUSAL = {
  errorCodePrefix: SUBCONTRACT_ERROR_CODE_PREFIX,
  kinds: SUBCONTRACT_WRITE_ERROR_KIND_NAMES,
  issueOf,
} as const;

function isWriterKind(kind: SubcontractFailureKind): kind is SubcontractWriteErrorKind {
  return (SUBCONTRACT_WRITE_ERROR_KIND_NAMES as readonly string[]).includes(kind);
}

/** **Η μία ερμηνεία** μιας αποτυχημένης εγγραφής συμφωνητικού, ρήτρας ή προτύπου. */
export function subcontractFailureOf(cause: unknown): SubcontractFailure {
  const { kind, issues, body } = writerRefusalOf(cause, SUBCONTRACT_REFUSAL);
  return { kind, issues, currentRevision: isWriterKind(kind) ? currentRevisionOf(body) : null };
}
