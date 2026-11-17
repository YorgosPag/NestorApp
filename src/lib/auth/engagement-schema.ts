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
import { isDossierShareDays, type DossierShareDays } from '@/config/engagement-policy';
import { PROPERTY_DOSSIER_FILE_TABS } from '@/config/upload-entry-points/entries-property-dossier';
import { isCdeAudience, type CdeAudience } from '@/types/container-access';
import {
  CONSENT_BASES,
  CONSENT_SOURCES,
  DOSSIER_ENGAGEMENT_ROLES,
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
 * Τα πεδία του οικοδεσπότη-**γραφείου** — υποχρεωτικά **μόνο** στα είδη που ζουν σε έργο. ADR-916 Φ-Ε1: ο φάκελος
 * ιδιώτη **δεν** τα έχει (ο οικοδεσπότης είναι ο γονέας της διαδρομής)· αν εμφανιστούν εκεί, αγνοούνται — κανείς
 * καταναλωτής δεν τα διαβάζει σε συμμετοχή φακέλου (ο τύπος δεν τα έχει).
 */
const projectHostShape = {
  hostCompanyId: nonEmpty,
  projectId: nonEmpty,
  origin: z.object({
    kind: z.literal('professional_appointment'),
    contactId: nonEmpty,
    invitationId: nonEmpty.optional(),
  }),
};

/** ADR-916 Φ-Ε1 — εύρος: καρτέλες **του καταλόγου** (καμία άγνωστη) + εξαιρέσεις, χωρίς διπλότυπα. */
export const dossierReachSchema = z.object({
  tabs: z.array(z.enum(PROPERTY_DOSSIER_FILE_TABS)).refine((tabs) => new Set(tabs).size === tabs.length),
  excludedFileIds: z.array(nonEmpty).refine((ids) => new Set(ids).size === ids.length),
});

/**
 * Το ζεύγος **υπόθεση ↔ ρόλος** (+ ό,τι ανήκει **μόνο** στο είδος) — διακριτή ένωση, ώστε το σχήμα να μην μπορεί να
 * διαβάσει «συμβολαιογράφο σε ανάθεση ΠΕΑ» ή «φάκελο ιδιώτη με οικοδεσπότη γραφείο». Ό,τι αναμιγνύει είδη ⇒ `null`.
 */
const subjectAndRole = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('conveyance_case'),
    subject: z.object({ kind: z.literal('conveyance_case'), caseId: nonEmpty }),
    role: z.enum(LEGAL_ENGAGEMENT_ROLES),
    ...projectHostShape,
  }),
  z.object({
    kind: z.literal('document_issuance'),
    subject: z.object({ kind: z.literal('document_issuance'), assignmentId: nonEmpty }),
    role: z.enum(ISSUANCE_ENGAGEMENT_ROLES),
    ...projectHostShape,
  }),
  z.object({
    kind: z.literal('property_dossier'),
    subject: z.object({ kind: z.literal('property_dossier'), dossierId: nonEmpty }),
    role: z.enum(DOSSIER_ENGAGEMENT_ROLES),
    origin: z.object({ kind: z.literal('owner_invitation'), invitationId: nonEmpty }),
    reach: dossierReachSchema,
    shareDays: z.custom<DossierShareDays>(isDossierShareDays),
  }),
]);

/** Τα πεδία που διαβάζει **μόνο** η διακριτή ένωση — μεταφέρονται αυτούσια από το ωμό έγγραφο. */
const KIND_FIELDS = ['subject', 'role', 'hostCompanyId', 'projectId', 'origin', 'reach', 'shareDays'] as const;
const rawRecord = z.record(z.string(), z.unknown());

const engagementSchema = z.object({
  id: nonEmpty,
  uid: nonEmpty,
  email: z.string(),
  template: z.custom<CdeAudience>(isCdeAudience),
  role: z.string(),
  subject: z.object({ kind: z.string() }).passthrough(),
  scopes: z.array(z.enum(ENGAGEMENT_SCOPES)),
  state: z.enum(ENGAGEMENT_STATES),
  expiresAt: nonEmpty,
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
 * Δύο περάσματα: (1) τα κοινά πεδία· (2) το ζεύγος υπόθεσης ↔ ρόλου **μαζί με τα πεδία του είδους** (οικοδεσπότης
 * γραφείου · ή εύρος/διάρκεια φακέλου) ως διακριτή ένωση. Μετά, το πρότυπο και το εύρος πρέπει να είναι **ακριβώς**
 * αυτά που παράγει το είδος (`TEMPLATE_OF_SUBJECT` · `SCOPE_OF_SUBJECT`) — ADR-862 §5.3.10. Το αποτέλεσμα χτίζεται
 * **ανά κλάδο**, ώστε ο τύπος να στενεύει χωρίς κανένα `as`.
 */
export function parseEngagement(raw: unknown): Engagement | null {
  const base = engagementSchema.safeParse(raw);
  const record = rawRecord.safeParse(raw);
  if (!base.success || !record.success) return null;
  const kindFields = Object.fromEntries(KIND_FIELDS.map((field) => [field, record.data[field]]));
  const pair = subjectAndRole.safeParse({ ...kindFields, kind: base.data.subject.kind });
  if (!pair.success) return null;
  const kind = pair.data.kind;
  if (base.data.template !== TEMPLATE_OF_SUBJECT[kind]) return null;
  if (!base.data.scopes.every((scope) => scope === SCOPE_OF_SUBJECT[kind])) return null;
  const data = pair.data;
  switch (data.kind) {
    case 'conveyance_case':
      return { ...base.data, subject: data.subject, role: data.role, hostCompanyId: data.hostCompanyId, projectId: data.projectId, origin: data.origin };
    case 'document_issuance':
      return { ...base.data, subject: data.subject, role: data.role, hostCompanyId: data.hostCompanyId, projectId: data.projectId, origin: data.origin };
    case 'property_dossier':
      return { ...base.data, subject: data.subject, role: data.role, origin: data.origin, reach: data.reach, shareDays: data.shareDays };
  }
}
