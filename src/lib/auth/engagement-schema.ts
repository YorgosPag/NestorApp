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

import { isNationalRegistry, isRegistryAuthority, type RegistryAuthorityId } from '@/constants/professional-registries';
import { isCdeAudience, type CdeAudience } from '@/types/container-access';
import {
  CONSENT_BASES,
  CONSENT_SOURCES,
  ENGAGEMENT_SCOPES,
  ENGAGEMENT_SIDES,
  ENGAGEMENT_STATES,
  ISSUANCE_ENGAGEMENT_ROLES,
  LEGAL_ENGAGEMENT_ROLES,
  SCOPE_OF_SUBJECT,
  TEMPLATE_OF_SUBJECT,
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

/**
 * ADR-862 §5.3.10 — δηλωμένη ιδιότητα σε **οποιαδήποτε** αρχή. Σε **εθνική** αρχή (ΥΠΕΝ · ΤΕΕ) ο σύλλογος/περιφέρεια
 * **δεν υπάρχει** ⇒ πρέπει να είναι `null`· σε αρχή με παραρτήματα μένει προαιρετικός, όπως ήταν (ADR-901 Ε-4).
 */
const declaredCredentialSchema = z.object({
  authority: z.custom<RegistryAuthorityId>((v) => typeof v === 'string' && isRegistryAuthority(v)),
  number: nonEmpty,
  chapter: z.string().nullable(),
  assurance: z.literal('declared'),
  declaredAt: nonEmpty,
}).refine((c) => !isNationalRegistry(c.authority) || c.chapter === null);

/**
 * Το ζεύγος **υπόθεση ↔ ρόλος** — διακριτή ένωση, ώστε το σχήμα να μην μπορεί να διαβάσει «συμβολαιογράφο σε
 * ανάθεση ΠΕΑ». Ό,τι αναμιγνύει είδη ⇒ αποτυχία ⇒ `null` (fail-closed).
 */
const subjectAndRole = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('conveyance_case'),
    subject: z.object({ kind: z.literal('conveyance_case'), caseId: nonEmpty }),
    role: z.enum(LEGAL_ENGAGEMENT_ROLES),
  }),
  z.object({
    kind: z.literal('document_issuance'),
    subject: z.object({ kind: z.literal('document_issuance'), assignmentId: nonEmpty }),
    role: z.enum(ISSUANCE_ENGAGEMENT_ROLES),
  }),
]);

const engagementSchema = z.object({
  id: nonEmpty,
  hostCompanyId: nonEmpty,
  projectId: nonEmpty,
  uid: nonEmpty,
  email: z.string(),
  template: z.custom<CdeAudience>(isCdeAudience),
  role: z.string(),
  subject: z.object({ kind: z.string() }).passthrough(),
  scopes: z.array(z.enum(ENGAGEMENT_SCOPES)),
  state: z.enum(ENGAGEMENT_STATES),
  expiresAt: nonEmpty,
  origin: z.object({
    kind: z.literal('professional_appointment'),
    contactId: nonEmpty,
    invitationId: nonEmpty.optional(),
  }),
  consents: z.array(engagementConsentSchema),
  declaredCredential: declaredCredentialSchema.optional(),
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

/**
 * Ωμό έγγραφο → `Engagement`, ή `null` αν δεν είναι συμμετοχή που καταλαβαίνουμε.
 *
 * Δύο περάσματα: (1) τα κοινά πεδία· (2) το ζεύγος υπόθεσης ↔ ρόλου ως διακριτή ένωση. Μετά, το πρότυπο και το
 * εύρος πρέπει να είναι **ακριβώς** αυτά που παράγει το είδος (`TEMPLATE_OF_SUBJECT` · `SCOPE_OF_SUBJECT`) —
 * ADR-862 §5.3.10. Το αποτέλεσμα χτίζεται **ανά κλάδο**, ώστε ο τύπος να στενεύει χωρίς κανένα `as`.
 */
export function parseEngagement(raw: unknown): Engagement | null {
  const base = engagementSchema.safeParse(raw);
  if (!base.success) return null;
  const pair = subjectAndRole.safeParse({ kind: base.data.subject.kind, subject: base.data.subject, role: base.data.role });
  if (!pair.success) return null;
  const kind = pair.data.kind;
  if (base.data.template !== TEMPLATE_OF_SUBJECT[kind]) return null;
  if (!base.data.scopes.every((scope) => scope === SCOPE_OF_SUBJECT[kind])) return null;
  switch (pair.data.kind) {
    case 'conveyance_case':
      return { ...base.data, subject: pair.data.subject, role: pair.data.role };
    case 'document_issuance':
      return { ...base.data, subject: pair.data.subject, role: pair.data.role };
  }
}
