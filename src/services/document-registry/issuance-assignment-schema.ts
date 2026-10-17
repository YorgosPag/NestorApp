/**
 * @fileoverview ADR-915 §27 — η **ανάθεση έκδοσης**: το αποθηκευμένο έγγραφο, το σχήμα του δίσκου και η ΜΙΑ ταυτότητα.
 *   Καθαρό (χωρίς `server-only`): το διαβάζουν ο αναγνώστης, ο γραφέας και τα τεστ.
 * @related lib/document-validity/issuance-assignment.ts (ο μειωτής) · issuance-assignments.server.ts (I/O)
 * @module services/document-registry/issuance-assignment-schema
 *
 * Fail-closed, όπως το `obligor-designation-schema.ts`: έγγραφο που δεν περνά ⇒ `null` ⇒ ο αναγνώστης το αγνοεί **και**
 * το αναφέρει. ⛔ Ποτέ `as DocumentIssuanceAssignment`: μια «μαντεμένη» απόφαση θα έγραφε «Ανατέθηκε» χωρίς ιδιοκτήτη.
 */

import { z } from 'zod';

import { ISSUER_QUALIFICATIONS } from '@/config/document-validity/document-issuers';
import { DOCUMENT_KINDS, type DocumentKind } from '@/config/document-validity/document-validity';
import {
  INSTRUCTION_CHANNELS,
  ISSUANCE_NOTE_MAX,
  NOTICE_CHANNELS,
  REGISTRY_NUMBER_MAX,
  type IssuanceAssignmentRecord,
} from '@/lib/document-validity/issuance-assignment';
import { generateDeterministicDocumentIssuanceAssignmentId } from '@/services/enterprise-id.service';
import { REGISTRY_PROPERTY_SCOPES, type RegistryPropertyScope } from './document-registry.types';

/** Το αποθηκευμένο έγγραφο (`document_issuance_assignments`, deny-all, μόνο ο server). */
export interface DocumentIssuanceAssignment extends IssuanceAssignmentRecord {
  readonly id: string;
  readonly companyId: string;
  readonly propertyId: string;
  readonly scope: RegistryPropertyScope;
  readonly documentKind: DocumentKind;
  readonly updatedAt: string;
}

const nonEmpty = z.string().min(1);
const actorStamp = { at: nonEmpty };

const assignmentSchema = z.object({
  id: nonEmpty,
  companyId: nonEmpty,
  propertyId: nonEmpty,
  scope: z.enum(REGISTRY_PROPERTY_SCOPES),
  documentKind: z.enum(DOCUMENT_KINDS),
  professionalContactId: nonEmpty,
  credential: z.object({
    qualification: z.enum(ISSUER_QUALIFICATIONS),
    registryNumber: z.string().min(1).max(REGISTRY_NUMBER_MAX).nullable(),
  }),
  proposedAt: nonEmpty,
  proposedByUid: nonEmpty,
  decision: z.object({
    outcome: z.enum(['approved', 'rejected']),
    ownerContactId: nonEmpty,
    basis: z.literal('recorded-instruction'),
    channel: z.enum(INSTRUCTION_CHANNELS),
    note: z.string().max(ISSUANCE_NOTE_MAX).nullable(),
    recordedByUid: nonEmpty,
    ...actorStamp,
  }).nullable(),
  notice: z.object({ channel: z.enum(NOTICE_CHANNELS), byUid: nonEmpty, ...actorStamp }).nullable(),
  response: z.object({ outcome: z.enum(['accepted', 'declined']), recordedByUid: nonEmpty, ...actorStamp }).nullable(),
  cancellation: z.object({ byUid: nonEmpty, ...actorStamp }).nullable(),
  updatedAt: nonEmpty,
});

/** Ωμό έγγραφο → `DocumentIssuanceAssignment`, ή `null` αν δεν είναι ανάθεση που καταλαβαίνουμε. */
export function parseIssuanceAssignment(raw: unknown): DocumentIssuanceAssignment | null {
  const parsed = assignmentSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Τα γεγονότα μόνο — ό,τι κρίνει ο μειωτής, χωρίς την ταυτότητα. */
export function issuanceRecordOf(assignment: DocumentIssuanceAssignment): IssuanceAssignmentRecord {
  const { professionalContactId, credential, proposedAt, proposedByUid, decision, notice, response, cancellation } = assignment;
  return { professionalContactId, credential, proposedAt, proposedByUid, decision, notice, response, cancellation };
}

/** Η ΜΙΑ ταυτότητα ανά (γραφείο, ακίνητο, είδος) — ο γραφέας και ο αναγνώστης βρίσκουν το ίδιο έγγραφο χωρίς ερώτημα. */
export function issuanceAssignmentIdOf(companyId: string, propertyId: string, kind: DocumentKind): string {
  return generateDeterministicDocumentIssuanceAssignmentId(`${companyId}:${propertyId}:${kind}`);
}
