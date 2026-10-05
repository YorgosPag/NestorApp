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

import { isChapteredRegistry, type ChapteredRegistryId } from '@/constants/professional-registries';
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

/** Μία συναίνεση — το **ίδιο** σχήμα στη συμμετοχή και στην πρόσκληση που τη γεννά (ADR-901 Φ3). */
export const engagementConsentSchema = z.object({
  side: z.enum(ENGAGEMENT_SIDES),
  source: z.enum(CONSENT_SOURCES),
  basis: z.enum(CONSENT_BASES),
  attestedBy: nonEmpty,
  attestedAt: nonEmpty,
});

/**
 * ADR-901 §15 (Γ1) — ο χώρος «για λογαριασμό ποιου». `strict`: ένας προσωπικός κλάδος **με** `companyId` δεν
 * διαβάζεται (ADR-787 Ε-3 §3) — δεν «καθαρίζεται» σιωπηλά.
 */
const actingForSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('org'), companyId: nonEmpty }).strict(),
  z.object({ kind: z.literal('personal'), userId: nonEmpty }).strict(),
]);

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
  origin: z.object({
    kind: z.literal('professional_appointment'),
    contactId: nonEmpty,
    invitationId: nonEmpty.optional(),
  }),
  consents: z.array(engagementConsentSchema),
  declaredCredential: z.object({
    authority: z.custom<ChapteredRegistryId>((v) => typeof v === 'string' && isChapteredRegistry(v)),
    number: nonEmpty,
    chapter: z.string().nullable(),
    assurance: z.literal('declared'),
    declaredAt: nonEmpty,
  }).optional(),
  actingFor: actingForSchema.optional(),
  offeredBy: nonEmpty,
  offeredAt: nonEmpty,
  respondedAt: z.string().nullable(),
  revokedAt: z.string().optional(),
  revokedBy: z.string().nullable(),
  closedAt: z.string().nullable(),
  updatedAt: nonEmpty,
  // Προσωπικός χώρος **άλλου** ανθρώπου πάνω στη συμμετοχή δεν υπάρχει ως νόμιμη κατάσταση ⇒ μη αναγνώσιμο.
}).refine((e) => e.actingFor?.kind !== 'personal' || e.actingFor.userId === e.uid);

/** Ωμό έγγραφο → `Engagement`, ή `null` αν δεν είναι συμμετοχή που καταλαβαίνουμε. */
export function parseEngagement(raw: unknown): Engagement | null {
  const parsed = engagementSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
