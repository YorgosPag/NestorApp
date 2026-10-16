/**
 * Conveyance — το σχήμα του αποθηκευμένου εγγράφου `conveyance_cases/{id}` (ADR-901 §5.1).
 *
 * Ό,τι διαβάζεται από τη Firestore **επικυρώνεται** — ποτέ `as ConveyanceCase` σε δεδομένα
 * δίσκου. Έγγραφο που δεν περνά ⇒ ο server το αναφέρει ως αλλοιωμένο, δεν το «μαντεύει».
 *
 * @module lib/conveyance/conveyance-case-schema
 */

import { z } from 'zod';
import { CONVEYANCE_FACT_IDS, CONVEYANCE_PARTY_FACT_IDS, CONVEYANCE_PROFILES } from '@/config/conveyance-checklist/types';
import { CONVEYANCE_SELLER_CAPACITIES, REVIEW_VERDICTS, STORED_CASE_STATES, type ConveyanceCase } from '@/types/conveyance-case';
import { upcastStoredCase } from './case-upcast';

const factAnswerSchema = z.object({
  value: z.boolean(),
  answeredBy: z.string(),
  answeredAt: z.string(),
});

const overrideSchema = z.object({
  notApplicable: z.object({ reason: z.string(), markedBy: z.string(), markedAt: z.string() }).optional(),
  review: z.object({
    verdict: z.enum(REVIEW_VERDICTS),
    fileId: z.string().nullable(),
    fileFingerprint: z.string().nullable(),
    issuedOn: z.string().nullable(),
    // ADR-915 §14 — υποθέσεις πριν την §14 δεν έχουν το πεδίο ⇒ `null` («δεν δηλώθηκε»), καμία μετάπτωση.
    printedValidUntil: z.string().nullable().default(null),
    reason: z.string().nullable(),
    reviewedBy: z.string(),
    reviewedAt: z.string(),
  }).optional(),
});

const conveyanceCaseSchema = z.object({
  id: z.string().min(1),
  companyId: z.string().min(1),
  subject: z.object({
    kind: z.literal('property'),
    propertyId: z.string().min(1),
    buildingId: z.string().nullable(),
    projectId: z.string().nullable(),
    appurtenances: z.array(z.object({ entityType: z.enum(['parking_spot', 'storage']), entityId: z.string() })),
  }),
  profile: z.enum(CONVEYANCE_PROFILES),
  parties: z.object({
    // ADR-915 §22 — λίστα προσώπων· το παλιό `seller` μεταφράζεται από το `upcastStoredCase` πριν φτάσει εδώ.
    sellers: z.array(z.object({
      key: z.string().min(1),
      contactId: z.string().nullable(),
      kind: z.enum(['person', 'legal_entity']),
      // ADR-915 §23 — πριν από την §23 ο ΜΟΝΟΣ δρόμος που έγραφε πωλητή ήταν η εταιρεία του έργου ⇒ η απουσία σημαίνει
      // `principal` με βεβαιότητα, όχι μαντεψιά (schema evolution στην ανάγνωση, όπως η §22 Ε3).
      capacity: z.enum(CONVEYANCE_SELLER_CAPACITIES).default('principal'),
    })),
    buyers: z.array(z.object({ contactId: z.string() })),
  }),
  facts: z.record(z.enum(CONVEYANCE_FACT_IDS), factAnswerSchema),
  partyFacts: z.record(z.string(), z.record(z.enum(CONVEYANCE_PARTY_FACT_IDS), factAnswerSchema)),
  overrides: z.record(z.string(), overrideSchema),
  storedState: z.enum(STORED_CASE_STATES),
  targetSigningDate: z.string().nullable(),
  catalogVersion: z.string(),
  version: z.number().int().nonnegative(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  cancellation: z.object({ reason: z.string(), by: z.string(), at: z.string() }).nullable(),
});

/**
 * `null` ⇒ το έγγραφο δεν έχει το σχήμα της υπόθεσης. Παλιά έγγραφα (ένας `seller`, ADR-915 §22) μεταφράζονται
 * **πριν** από την επικύρωση (`upcastStoredCase`) — η πρώτη εγγραφή ολόκληρου εγγράφου τα αποθηκεύει στο νέο σχήμα.
 */
export function parseConveyanceCase(data: unknown): ConveyanceCase | null {
  const result = conveyanceCaseSchema.safeParse(upcastStoredCase(data));
  return result.success ? result.data : null;
}
