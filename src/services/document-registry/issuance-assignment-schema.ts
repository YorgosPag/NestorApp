/**
 * @fileoverview ADR-915 §27 — η **ανάθεση έκδοσης**: το αποθηκευμένο έγγραφο, το σχήμα του δίσκου και η ΜΙΑ ταυτότητα.
 *   Καθαρό (χωρίς `server-only`): το διαβάζουν ο αναγνώστης, ο γραφέας και τα τεστ.
 * @related lib/document-validity/issuance-assignment.ts (ο μειωτής) · issuance-assignments.server.ts (I/O)
 * @module services/document-registry/issuance-assignment-schema
 *
 * ⚠️ §28: τα πεδία συνδέσμων (`approvalRequest` · βάσεις-ενώσεις) είναι **υποχρεωτικά** — το Στάδιο Α δεν έφτασε ποτέ
 * στην παραγωγή, άρα δεν υπάρχει παλιό σχήμα να διαβαστεί (δηλωμένο στο ADR-915 §28).
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
  LINK_VERIFICATIONS,
  NOTICE_CHANNELS,
  REGISTRY_NUMBER_MAX,
  type IssuanceAssignmentRecord,
} from '@/lib/document-validity/issuance-assignment';
import { ISSUANCE_DELIVERY_OUTCOMES } from '@/lib/document-validity/issuance-delivery';
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
const note = z.string().max(ISSUANCE_NOTE_MAX).nullable();
const delivery = z.enum(ISSUANCE_DELIVERY_OUTCOMES);
const deliverySchema = z.object({ recipient: delivery, coOwners: z.record(z.string(), delivery) }).nullable();
/** §29 — έγγραφα του §28 δεν έγραφαν επαλήθευση: διαβάζονται ως «μόνο σύνδεσμος», που ήταν και η αλήθεια τους. */
const verification = z.enum(LINK_VERIFICATIONS).default('link');

/** §28 Η-Β2 — η βάση είναι **ένωση**: καταγραφή του γραφείου ή ο ίδιος ο υπεύθυνος με σύνδεσμο. Τίποτα ενδιάμεσο. */
const decisionSchema = z.discriminatedUnion('basis', [
  z.object({ basis: z.literal('recorded-instruction'), channel: z.enum(INSTRUCTION_CHANNELS), recordedByUid: nonEmpty }),
  z.object({ basis: z.literal('owner-link-approval'), invitationId: nonEmpty, verifiedBy: verification }),
]).and(z.object({ outcome: z.enum(['approved', 'rejected']), ownerContactId: nonEmpty, note, at: nonEmpty }));

const responseSchema = z.discriminatedUnion('basis', [
  z.object({ basis: z.literal('recorded'), recordedByUid: nonEmpty }),
  z.object({ basis: z.literal('professional-link'), invitationId: nonEmpty, verifiedBy: verification }),
]).and(z.object({ outcome: z.enum(['accepted', 'declined']), note, at: nonEmpty }));

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
  approvalRequest: z.object({
    invitationId: nonEmpty, ownerContactId: nonEmpty, note, at: nonEmpty, byUid: nonEmpty, verification, delivery: deliverySchema,
  }).nullable(),
  decision: decisionSchema.nullable(),
  notice: z.object({
    channel: z.enum(NOTICE_CHANNELS), at: nonEmpty, byUid: nonEmpty, invitationId: nonEmpty.nullable(),
    verification: z.enum(LINK_VERIFICATIONS).nullable().default(null), note, delivery: deliverySchema,
  }).nullable(),
  response: responseSchema.nullable(),
  cancellation: z.object({ byUid: nonEmpty, at: nonEmpty }).nullable(),
  updatedAt: nonEmpty,
});

/** Ωμό έγγραφο → `DocumentIssuanceAssignment`, ή `null` αν δεν είναι ανάθεση που καταλαβαίνουμε. */
export function parseIssuanceAssignment(raw: unknown): DocumentIssuanceAssignment | null {
  const parsed = assignmentSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Τα γεγονότα μόνο — ό,τι κρίνει ο μειωτής, χωρίς την ταυτότητα. */
export function issuanceRecordOf(assignment: DocumentIssuanceAssignment): IssuanceAssignmentRecord {
  const { professionalContactId, credential, proposedAt, proposedByUid, approvalRequest, decision, notice, response, cancellation } = assignment;
  return { professionalContactId, credential, proposedAt, proposedByUid, approvalRequest, decision, notice, response, cancellation };
}

/** Η ΜΙΑ ταυτότητα ανά (γραφείο, ακίνητο, είδος) — ο γραφέας και ο αναγνώστης βρίσκουν το ίδιο έγγραφο χωρίς ερώτημα. */
export function issuanceAssignmentIdOf(companyId: string, propertyId: string, kind: DocumentKind): string {
  return generateDeterministicDocumentIssuanceAssignmentId(`${companyId}:${propertyId}:${kind}`);
}
