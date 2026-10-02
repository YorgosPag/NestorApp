/**
 * Conveyance — το σχήμα του αποθηκευμένου εγγράφου `conveyance_cases/{id}` (ADR-901 §5.1).
 *
 * Ό,τι διαβάζεται από τη Firestore **επικυρώνεται** — ποτέ `as ConveyanceCase` σε δεδομένα
 * δίσκου. Έγγραφο που δεν περνά ⇒ ο server το αναφέρει ως αλλοιωμένο, δεν το «μαντεύει».
 *
 * @module lib/conveyance/conveyance-case-schema
 */

import { z } from 'zod';
import { CONVEYANCE_FACT_IDS, CONVEYANCE_PROFILES } from '@/config/conveyance-checklist/types';
import { REVIEW_VERDICTS, STORED_CASE_STATES, type ConveyanceCase } from '@/types/conveyance-case';

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
    seller: z.object({ contactId: z.string().nullable(), kind: z.enum(['person', 'legal_entity']) }),
    buyers: z.array(z.object({ contactId: z.string() })),
  }),
  facts: z.record(z.enum(CONVEYANCE_FACT_IDS), factAnswerSchema),
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

/** `null` ⇒ το έγγραφο δεν έχει το σχήμα της υπόθεσης. */
export function parseConveyanceCase(data: unknown): ConveyanceCase | null {
  const result = conveyanceCaseSchema.safeParse(data);
  return result.success ? result.data : null;
}
