/**
 * @fileoverview **Τα αιτήματα του κατόχου προς τις πόρτες πρόσβασης** του φακέλου του (ADR-916 Φ-Ε1 Σ2).
 * @module lib/property-dossier/dossier-access-request-schema
 * @related `lib/auth/engagement-schema.ts` (`dossierReachSchema` — το ΕΝΑ σχήμα εύρους) ·
 *          `config/engagement-policy.ts` (το κλειστό μενού ημερών) · `app/api/workspace-invitations` (ίδιο email)
 *
 * 🔑 **Κανένα δεύτερο λεξιλόγιο**: ρόλοι από `DOSSIER_ENGAGEMENT_ROLES`, καρτέλες + εξαιρέσεις από `dossierReachSchema`,
 *    ημέρες από `isDossierShareDays`. Το σχήμα εδώ προσθέτει **μόνο** ό,τι είναι πολιτική της πόρτας: πρόσκληση χωρίς
 *    **καμία** καρτέλα δεν δίνει τίποτα ⇒ άρνηση στην είσοδο, όχι ένα email που υπόσχεται κενό.
 * 🔑 Το email περνά **ωμό** (όριο μήκους μόνο): η κανονικοποίηση είναι του `normaliseChannelEmail`, μέσα στη μηχανή.
 * 🔴 `.strict()` παντού: ο κάτοχος **δεν** έρχεται ποτέ από το σώμα — ένα `userId`/`dossierId` στο σώμα απορρίπτεται.
 *
 * **Layering**: leaf — καθαρά σχήματα, καμία εξάρτηση από Firestore ή React.
 */

import { z } from 'zod';

import { isDossierShareDays, type DossierShareDays } from '@/config/engagement-policy';
import { dossierReachSchema } from '@/lib/auth/engagement-schema';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { enterpriseIdFromRequest } from '@/services/enterprise-id-parse';
import { DOSSIER_ENGAGEMENT_ROLES } from '@/types/engagement';

const shareDaysSchema = z.custom<DossierShareDays>(isDossierShareDays);

/** Εύρος που **δίνει κάτι**: τουλάχιστον μία καρτέλα (το κλειστό λεξιλόγιο το κρίνει το `dossierReachSchema`). */
const grantingReachSchema = dossierReachSchema.refine((reach) => reach.tabs.length > 0);

/** `POST …/access/invitations` — ποιον, ως τι, τι θα δει, για πόσο. */
export const dossierInvitationRequestSchema = z.object({
  email: z.string().min(3).max(254),
  role: z.enum(DOSSIER_ENGAGEMENT_ROLES),
  reach: grantingReachSchema,
  shareDays: shareDaysSchema,
}).strict();

export type DossierInvitationRequest = z.infer<typeof dossierInvitationRequestSchema>;

/**
 * `POST …/access/[engagementId]` — **μία** πόρτα, τρεις πράξεις του κατόχου πάνω σε **μία** συμμετοχή (διακριτή
 * ένωση στο σώμα, όπως το `PATCH` του φακέλου): ανάκληση · ανανέωση από το μενού · αλλαγή εύρους.
 */
export const dossierEngagementChangeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('revoke') }).strict(),
  z.object({ action: z.literal('renew'), shareDays: shareDaysSchema }).strict(),
  z.object({ action: z.literal('reach'), reach: grantingReachSchema }).strict(),
]);

export type DossierEngagementChangeRequest = z.infer<typeof dossierEngagementChangeSchema>;

/** Ταυτότητα συμμετοχής από τη διαδρομή — λάθος πρόθεμα ⇒ `null` (η πόρτα απαντά 404, ίδια με «ανύπαρκτη»). */
export function engagementIdFrom(value: unknown): string | null {
  return enterpriseIdFromRequest(value, ENTERPRISE_ID_PREFIXES.ENGAGEMENT);
}

/** Ταυτότητα πρόσκλησης από τη διαδρομή — λάθος πρόθεμα ⇒ `null`. */
export function engagementInvitationIdFrom(value: unknown): string | null {
  return enterpriseIdFromRequest(value, ENTERPRISE_ID_PREFIXES.ENGAGEMENT_INVITATION);
}
