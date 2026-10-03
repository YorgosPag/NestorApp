/**
 * Το σχήμα του αποθηκευμένου εγγράφου συμμετοχής (ADR-862 Φ1) — **η μία μετάφραση** δίσκου → τύπου.
 *
 * Ό,τι διαβάζεται επικυρώνεται· έγγραφο που δεν περνά ⇒ `null` ⇒ ο αναγνώστης το αναφέρει ως
 * **μη αναγνώσιμο** (fail-closed). ⛔ Ποτέ `as Engagement` σε δεδομένα δίσκου: ένα χαλασμένο
 * `state` που «μαντεύεται» ως `active` είναι πρόσβαση που κανείς δεν έδωσε (ADR-749).
 *
 * Καθαρό — το καλούν αναγνώστης, γραφέας (μέσα στη συναλλαγή) και άγκυρες.
 *
 * @module lib/auth/engagement-schema
 */

import { z } from 'zod';

import { isCdeAudience, type CdeAudience } from '@/types/container-access';
import {
  CONSENT_BASES,
  CONSENT_SOURCES,
  ENGAGEMENT_SCOPES,
  ENGAGEMENT_SIDES,
  ENGAGEMENT_STATES,
  LEGAL_ENGAGEMENT_ROLES,
  type Engagement,
} from '@/types/engagement';

const nonEmpty = z.string().min(1);

const engagementSchema = z.object({
  id: nonEmpty,
  hostCompanyId: nonEmpty,
  projectId: nonEmpty,
  uid: nonEmpty,
  email: z.string(),
  template: z.custom<CdeAudience>(isCdeAudience),
  role: z.enum(LEGAL_ENGAGEMENT_ROLES),
  subject: z.object({ kind: z.literal('conveyance_case'), caseId: nonEmpty }),
  scopes: z.array(z.enum(ENGAGEMENT_SCOPES)),
  state: z.enum(ENGAGEMENT_STATES),
  expiresAt: nonEmpty,
  origin: z.object({ kind: z.literal('professional_appointment'), contactId: nonEmpty }),
  consents: z.array(z.object({
    side: z.enum(ENGAGEMENT_SIDES),
    source: z.enum(CONSENT_SOURCES),
    basis: z.enum(CONSENT_BASES),
    attestedBy: nonEmpty,
    attestedAt: nonEmpty,
  })),
  offeredBy: nonEmpty,
  offeredAt: nonEmpty,
  respondedAt: z.string().nullable(),
  revokedAt: z.string().optional(),
  revokedBy: z.string().nullable(),
  closedAt: z.string().nullable(),
  updatedAt: nonEmpty,
});

/** Ωμό έγγραφο → `Engagement`, ή `null` αν δεν είναι συμμετοχή που καταλαβαίνουμε. */
export function parseEngagement(raw: unknown): Engagement | null {
  const parsed = engagementSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
