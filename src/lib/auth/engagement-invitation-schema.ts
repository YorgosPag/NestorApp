/**
 * Το σχήμα του αποθηκευμένου εγγράφου πρόσκλησης συμμετοχής (ADR-901 Φ3 · ADR-862 §5.3.11) — **η μία μετάφραση**
 * δίσκου → τύπου, και τύπου → δίσκου.
 *
 * Ό,τι δεν διαβάζεται ⇒ `null` ⇒ η μηχανή το λέει `invitation-corrupt` — **καμία** συμμετοχή δεν γεννιέται από
 * έγγραφο που δεν καταλάβαμε (ένας «μαντεμένος» ρόλος ή χώρος = πρόσβαση που κανείς δεν έδωσε, ADR-749).
 *
 * 🔑 **Τρία είδη υπόθεσης, μία συλλογή, καμία μετανάστευση**:
 * - **μεταβίβαση** — όπως πάντα: επίπεδο `caseId`, **χωρίς** `subject` στον δίσκο. Το `subject` το παράγει η ανάγνωση.
 * - **ανάθεση έκδοσης** — `subject: {kind:'document_issuance', assignmentId}`, το ίδιο σχήμα με τη συμμετοχή.
 * - **φάκελος ιδιώτη** (ADR-916 Φ-Ε1) — `subject: {kind:'property_dossier', dossierId}` + εύρος + διάρκεια, **χωρίς**
 *   κανένα πεδίο γραφείου (μισθωτής · έργο · επαφή).
 * Έγγραφο με `subject` άλλου είδους, ή χωρίς `subject` και χωρίς `caseId` ⇒ `null` (ποτέ «περίπου»).
 *
 * Καθαρό — το καλούν έκδοση, όψη, εξαργύρωση, υπενθύμιση και άγκυρες.
 *
 * @module lib/auth/engagement-invitation-schema
 */

import { z } from 'zod';

import { ISSUER_QUALIFICATIONS } from '@/config/document-validity/document-issuers';
import { DOCUMENT_KINDS } from '@/config/document-validity/document-validity';
import { dossierReachSchema, engagementConsentSchema } from '@/lib/auth/engagement-schema';
import { isDossierShareDays, type DossierShareDays } from '@/config/engagement-policy';
import { normalizeToISO } from '@/lib/date-local';
import { DOSSIER_ENGAGEMENT_ROLES, ISSUANCE_ENGAGEMENT_ROLES, LEGAL_ENGAGEMENT_ROLES } from '@/types/engagement';
import {
  isConveyanceInvitation,
  type ConveyanceEngagementInvitation,
  type DossierEngagementInvitation,
  type EngagementInvitation,
  type IssuanceEngagementInvitation,
} from '@/types/engagement-invitation';
import { INVITATION_STATES } from '@/types/invitation-core';

const nonEmpty = z.string().min(1);
/** Στιγμή — δέχεται Timestamp/Date/ISO του δίσκου, δίνει **πάντα** ISO (ή αποτυγχάνει). */
const instant = z.unknown().transform((value, ctx) => {
  const iso = normalizeToISO(value);
  if (iso === null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'unreadable instant' });
  return iso ?? '';
});
const optionalInstant = z.unknown().transform((value, ctx) => {
  if (value === null || value === undefined) return null;
  const iso = normalizeToISO(value);
  if (iso === null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'unreadable instant' });
  return iso;
});

/** Τα κοινά πεδία κάθε πρόσκλησης συμμετοχής. */
const baseShape = {
  inviteeEmail: nonEmpty,
  invitedByUid: nonEmpty,
  nonceHash: nonEmpty,
  state: z.enum(INVITATION_STATES),
  createdAt: instant,
  expiresAt: instant,
  openedAt: optionalInstant,
  resolvedAt: optionalInstant,
  resolvedByUid: z.string().nullable().optional().transform((v) => v ?? null),
  mailboxProvenAt: optionalInstant,
  credentialHint: z.object({ number: z.string().nullable(), chapter: z.string().nullable() }),
  reminderDueAt: instant,
  reminderSentAt: optionalInstant,
} as const;

/** Τα πεδία του οικοδεσπότη-**γραφείου** — μόνο στα είδη που ζουν σε έργο (ADR-916 Φ-Ε1). */
const projectHostShape = {
  ...baseShape,
  hostCompanyId: nonEmpty,
  projectId: nonEmpty,
  propertyId: nonEmpty,
  contactId: nonEmpty,
  consents: z.array(engagementConsentSchema),
} as const;

/** Μεταβίβαση — το σχήμα όπως ήταν πάντα (το `subject` λείπει από τον δίσκο). */
const conveyanceSchema = z.object({
  ...projectHostShape,
  subject: z.undefined(),
  caseId: nonEmpty,
  role: z.enum(LEGAL_ENGAGEMENT_ROLES),
});

/** Ανάθεση έκδοσης — `subject` ρητό· ο ρόλος, το είδος εγγράφου και το προσόν από τα κλειστά λεξιλόγια. */
const issuanceSchema = z.object({
  ...projectHostShape,
  subject: z.object({ kind: z.literal('document_issuance'), assignmentId: nonEmpty }),
  role: z.enum(ISSUANCE_ENGAGEMENT_ROLES),
  documentKind: z.enum(DOCUMENT_KINDS),
  qualification: z.enum(ISSUER_QUALIFICATIONS),
});

/**
 * ADR-916 Φ-Ε1 — φάκελος ιδιώτη: ο ρόλος, οι καρτέλες και η διάρκεια από τα κλειστά λεξιλόγια της πολιτικής. Πεδία
 * γραφείου (αν βρεθούν) **αφαιρούνται** στην ανάγνωση — ο τύπος δεν τα έχει, άρα κανείς δεν τα διαβάζει.
 */
const dossierSchema = z.object({
  ...baseShape,
  subject: z.object({ kind: z.literal('property_dossier'), dossierId: nonEmpty }),
  role: z.enum(DOSSIER_ENGAGEMENT_ROLES),
  reach: dossierReachSchema,
  shareDays: z.custom<DossierShareDays>(isDossierShareDays),
});

/** Ωμό έγγραφο → `EngagementInvitation`, ή `null` αν δεν είναι πρόσκληση που καταλαβαίνουμε. */
export function engagementInvitationFromDocument(raw: unknown, id: string): EngagementInvitation | null {
  const dossier = dossierSchema.safeParse(raw);
  if (dossier.success) return { ...dossier.data, id } satisfies DossierEngagementInvitation;
  const issuance = issuanceSchema.safeParse(raw);
  if (issuance.success) return { ...issuance.data, id } satisfies IssuanceEngagementInvitation;
  const conveyance = conveyanceSchema.safeParse(raw);
  if (!conveyance.success) return null;
  const { subject: _absent, ...stored } = conveyance.data;
  return { ...stored, id, subject: { kind: 'conveyance_case', caseId: stored.caseId } } satisfies ConveyanceEngagementInvitation;
}

/**
 * Τύπος → δίσκος. Η μεταβίβαση γράφεται **ακριβώς όπως πριν** (χωρίς `subject` — μία αλήθεια, το `caseId`)· η
 * ανάθεση έκδοσης και ο φάκελος με το `subject` τους.
 */
export function engagementInvitationToDocument(
  invitation: EngagementInvitation,
): IssuanceEngagementInvitation | DossierEngagementInvitation | Omit<ConveyanceEngagementInvitation, 'subject'> {
  if (!isConveyanceInvitation(invitation)) return invitation;
  const { subject: _derived, ...stored } = invitation;
  return stored;
}
