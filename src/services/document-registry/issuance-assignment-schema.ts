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
import { MYDATA_MARK_PATTERN, QUOTE_BASES, QUOTE_MAX_REVISION, QUOTE_SCOPE_ITEMS } from '@/lib/document-validity/issuance-quote';
import { ISSUANCE_DELIVERY_POLICY } from '@/lib/document-validity/issuance-delivery-due';
import { ISSUANCE_DELIVERY_REMINDER_POLICY } from '@/lib/document-validity/issuance-delivery-reminder';
import { DELIVERY_CHANGE_OUTCOMES, DELIVERY_CHANGE_POLICY } from '@/lib/document-validity/issuance-delivery-change';
import { INSPECTION_CONTACT_POLICY, INSPECTION_CONTACT_ROLES } from '@/lib/document-validity/issuance-inspection-contact';
import { OWNER_ATTESTATION_POLICY, OWNER_VERDICTS } from '@/lib/document-validity/issuance-owner-attestation';
import { advanceTermsSchema, deliveryBusinessDaysSchema, isoDay, vatRatePercentSchema } from '@/lib/document-validity/issuance-request';
import { ADVANCE_POLICY, ADVANCE_RELEASE_BASES } from '@/lib/document-validity/issuance-advance';
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
/** §31 — έγγραφα του §28–§30 δεν έγραφαν υπενθυμίσεις: διαβάζονται ως «καμία», που ήταν και η αλήθεια τους. */
const remindersSchema = z.object({ dueAt: nonEmpty.nullable(), sentAt: z.array(nonEmpty) }).nullable().default(null);

/** §28 Η-Β2 — η βάση είναι **ένωση**: καταγραφή του γραφείου ή ο ίδιος ο υπεύθυνος με σύνδεσμο. Τίποτα ενδιάμεσο. */
const decisionSchema = z.discriminatedUnion('basis', [
  z.object({ basis: z.literal('recorded-instruction'), channel: z.enum(INSTRUCTION_CHANNELS), recordedByUid: nonEmpty }),
  z.object({ basis: z.literal('owner-link-approval'), invitationId: nonEmpty, verifiedBy: verification }),
]).and(z.object({
  outcome: z.enum(['approved', 'rejected']),
  /** §42 — έγγραφα πριν από την προσφορά δεν το έγραφαν: διαβάζονται ως παλιά ανάθεση (`null`), που ήταν και η αλήθεια τους. */
  quoteRevision: z.number().int().min(1).nullable().default(null),
  ownerContactId: nonEmpty,
  /** §45.15 — αποφάσεις πριν από το 1β-γ δεν έγραφαν τεκμήριο ιδιοκτητών: «δεν ζητήθηκε», που ήταν και η αλήθεια τους. */
  ownerAttestation: z.object({
    owners: z.array(z.object({ contactId: nonEmpty, verdict: z.enum(OWNER_VERDICTS), vatNumber: nonEmpty.nullable() }))
      .max(OWNER_ATTESTATION_POLICY.maxOwners),
    missingNote: z.string().min(1).max(OWNER_ATTESTATION_POLICY.missingNoteMax).nullable(),
  }).nullable().default(null),
  note,
  at: nonEmpty,
}));

const minor = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

/** §42 — μία αναθεώρηση της προσφοράς (χωρίς την προηγούμενή της). */
const quoteRevisionSchema = z.object({
  basis: z.enum(QUOTE_BASES),
  amountMinor: minor,
  vatRatePercent: vatRatePercentSchema,
  vatIncluded: z.boolean(),
  validUntil: isoDay,
  scope: z.array(z.enum(QUOTE_SCOPE_ITEMS)).min(1),
  note,
  /** §45 Φ2 — προσφορές πριν από τη Φ2 δεν είχαν χρόνο παράδοσης: «καμία δέσμευση», που ήταν και η αλήθεια τους. */
  deliveryBusinessDays: deliveryBusinessDaysSchema.nullable().default(null),
  /** ADR-943 — προσφορές πριν από το ADR-943 δεν ζητούσαν προκαταβολή: «καμία», που ήταν και η αλήθεια τους. */
  advance: advanceTermsSchema.nullable().default(null),
  revision: z.number().int().min(1).max(QUOTE_MAX_REVISION),
  at: nonEmpty,
  submission: z.discriminatedUnion('by', [
    z.object({ by: z.literal('professional-link'), invitationId: nonEmpty }),
    z.object({ by: z.literal('recorded'), recordedByUid: nonEmpty }),
  ]),
});

/** §42 — έγγραφα πριν από την προσφορά δεν είχαν τα πεδία: «καμία προσφορά / κανένα παραστατικό». */
const quoteSchema = quoteRevisionSchema.extend({ previous: quoteRevisionSchema.nullable() }).nullable().default(null);
const receiptSchema = z.object({
  mark: z.string().regex(MYDATA_MARK_PATTERN), issuedOn: isoDay, totalMinor: minor, at: nonEmpty, recordedByUid: nonEmpty,
}).nullable().default(null);

/** ADR-943 — έγγραφα πριν από το ADR-943 δεν είχαν κινήσεις προκαταβολής: «καμία», που ήταν και η αλήθεια τους. */
const advanceEventsSchema = z.array(z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('funded'), amountMinor: minor, paymentReference: nonEmpty, withdrawalWaiverAt: nonEmpty.nullable(), at: nonEmpty }),
  z.object({ kind: z.literal('work-started'), at: nonEmpty, byUid: nonEmpty, engagementId: nonEmpty }),
  z.object({
    kind: z.literal('start-objected'),
    reason: z.string().min(1).max(ADVANCE_POLICY.objectionReasonMax),
    at: nonEmpty,
    objection: z.discriminatedUnion('by', [
      z.object({ by: z.literal('office'), uid: nonEmpty }),
      z.object({ by: z.literal('owner-link'), invitationId: nonEmpty }),
    ]),
  }),
  z.object({ kind: z.literal('released'), amountMinor: minor, transferReference: nonEmpty, basis: z.enum(ADVANCE_RELEASE_BASES), at: nonEmpty }),
  z.object({ kind: z.literal('refunded'), amountMinor: minor, reference: nonEmpty, at: nonEmpty }),
])).max(ADVANCE_POLICY.maxEvents).default([]);

/** §45 Φ2 — έγγραφα πριν από τη Φ2 δεν είχαν καταχωρίσεις προθεσμίας: «καμία», που ήταν και η αλήθεια τους. */
const deliveryScheduleSchema = z.array(z.object({
  dueOn: isoDay, reason: note, at: nonEmpty, byUid: nonEmpty,
})).max(ISSUANCE_DELIVERY_POLICY.maxScheduleEntries).default([]);

/** §45 Φ3 — έγγραφα πριν από τη Φ3 δεν είχαν υπενθυμίσεις παράδοσης: «καμία», που ήταν και η αλήθεια τους. */
const deliveryRemindersSchema = z.object({
  forDueOn: isoDay.nullable(),
  dueAt: nonEmpty.nullable(),
  sentAt: z.array(nonEmpty).max(ISSUANCE_DELIVERY_REMINDER_POLICY.maxAutomatic),
  manual: z.array(z.object({ at: nonEmpty, byUid: nonEmpty })).max(ISSUANCE_DELIVERY_REMINDER_POLICY.maxManual),
}).nullable().default(null);

/** §45.15 — έγγραφα πριν από το 1β δεν είχαν υπεύθυνο αυτοψίας: «κανείς», που ήταν και η αλήθεια τους. */
const inspectionContactsSchema = z.array(z.object({
  contactId: nonEmpty,
  role: z.enum(INSPECTION_CONTACT_ROLES),
  roleOther: z.string().min(1).max(INSPECTION_CONTACT_POLICY.roleOtherMax).nullable(),
  at: nonEmpty,
  byUid: nonEmpty,
})).max(INSPECTION_CONTACT_POLICY.maxEntries).default([]);

const responseSchema = z.discriminatedUnion('basis', [
  z.object({ basis: z.literal('recorded'), recordedByUid: nonEmpty }),
  z.object({ basis: z.literal('professional-link'), invitationId: nonEmpty, verifiedBy: verification }),
]).and(z.object({ outcome: z.enum(['accepted', 'declined']), note, at: nonEmpty }));

/** §45.20 Φ6γ — έγγραφα πριν από τη Φ6γ δεν είχαν αιτήματα αλλαγής προθεσμίας: «κανένα», που ήταν και η αλήθεια τους. */
const changeReason = z.string().min(1).max(DELIVERY_CHANGE_POLICY.reasonMax);
const deliveryChangeRequestsSchema = z.array(z.object({
  dueOn: isoDay,
  reason: changeReason,
  at: nonEmpty,
  byUid: nonEmpty,
  engagementId: nonEmpty,
  answer: z.object({
    outcome: z.enum(DELIVERY_CHANGE_OUTCOMES), dueOn: isoDay.nullable(), reason: changeReason.nullable(), at: nonEmpty, byUid: nonEmpty,
  }).nullable(),
})).max(DELIVERY_CHANGE_POLICY.maxEntries).default([]);

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
    reminders: remindersSchema,
  }).nullable(),
  decision: decisionSchema.nullable(),
  notice: z.object({
    channel: z.enum(NOTICE_CHANNELS), at: nonEmpty, byUid: nonEmpty, invitationId: nonEmpty.nullable(),
    verification: z.enum(LINK_VERIFICATIONS).nullable().default(null), note, delivery: deliverySchema,
    reminders: remindersSchema,
  }).nullable(),
  response: responseSchema.nullable(),
  quote: quoteSchema,
  receipt: receiptSchema,
  deliverySchedule: deliveryScheduleSchema,
  deliveryReminders: deliveryRemindersSchema,
  inspectionContacts: inspectionContactsSchema,
  deliveryChangeRequests: deliveryChangeRequestsSchema,
  advanceEvents: advanceEventsSchema,
  advanceReceipt: receiptSchema,
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
  const {
    professionalContactId, credential, proposedAt, proposedByUid, approvalRequest, decision, notice, response, quote, receipt,
    deliverySchedule, deliveryReminders, inspectionContacts, deliveryChangeRequests, advanceEvents, advanceReceipt, cancellation,
  } = assignment;
  return {
    professionalContactId, credential, proposedAt, proposedByUid, approvalRequest, decision, notice, response, quote, receipt,
    deliverySchedule, deliveryReminders, inspectionContacts, deliveryChangeRequests, advanceEvents, advanceReceipt, cancellation,
  };
}

/** Η ΜΙΑ ταυτότητα ανά (γραφείο, ακίνητο, είδος) — ο γραφέας και ο αναγνώστης βρίσκουν το ίδιο έγγραφο χωρίς ερώτημα. */
export function issuanceAssignmentIdOf(companyId: string, propertyId: string, kind: DocumentKind): string {
  return generateDeterministicDocumentIssuanceAssignmentId(`${companyId}:${propertyId}:${kind}`);
}
