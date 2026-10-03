/**
 * =============================================================================
 * ΠΡΟΣΚΛΗΣΗ ΜΕ EMAIL ΣΕ ΕΠΑΓΓΕΛΜΑΤΙΑ ΤΗΣ ΥΠΟΘΕΣΗΣ — το τρίτο είδος της ΜΙΑΣ μηχανής (ADR-901 Φ3 · ADR-853 §20)
 * =============================================================================
 *
 * `engagement_invitations/{einv_…}` — top-level, **deny-all** στους κανόνες (μόνο Admin SDK).
 *
 * Ο δικηγόρος/συμβολαιογράφος **χωρίς λογαριασμό** δεν μπορεί να πάρει πρόταση `offered` (η συμμετοχή κλειδώνεται
 * σε `uid`). Η πρόσκληση είναι **το δικαίωμα να ζητήσει τη συμμετοχή** — όχι πρόσβαση (ADR-901 §5.3): η αποδοχή,
 * με λογαριασμό στο **ίδιο** email, γράφει τη συμμετοχή μέσω του ΕΝΟΣ γραφέα (`lib/auth/engagement-write.ts`).
 *
 * ⛔ **Ποτέ ολόκληρος χώρος** (ADR-901 Α1): κανένα πεδίο ρόλου χώρου, κανένα claim — μόνο ένας ρόλος υπόθεσης.
 *
 * @module types/engagement-invitation
 */

import type { EngagementConsent } from '@/types/engagement';
import { CORE_INVITATION_REFUSALS, type InvitationRecordCore, type InvitationState } from '@/types/invitation-core';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

/**
 * Οι αρνήσεις **του είδους** — κρίνονται μέσα στη συναλλαγή της αποδοχής· η πρόσκληση μένει `pending`.
 * - `slot-occupied` — η θέση έχει πια **άλλον** ζωντανό επαγγελματία.
 * - `role-conflict` — ο ίδιος άνθρωπος έχει ήδη **άλλη** θέση στην υπόθεση.
 * - `case-closed`   — η υπόθεση έκλεισε/ακυρώθηκε μετά την έκδοση.
 */
export const ENGAGEMENT_INVITATION_KIND_REFUSALS = ['slot-occupied', 'role-conflict', 'case-closed'] as const;
export type EngagementInvitationKindRefusal = (typeof ENGAGEMENT_INVITATION_KIND_REFUSALS)[number];

export const ENGAGEMENT_INVITATION_REFUSALS = [...CORE_INVITATION_REFUSALS, ...ENGAGEMENT_INVITATION_KIND_REFUSALS] as const;
export type EngagementInvitationRefusal = (typeof ENGAGEMENT_INVITATION_REFUSALS)[number];

export function isEngagementInvitationRefusal(value: unknown): value is EngagementInvitationRefusal {
  return typeof value === 'string' && (ENGAGEMENT_INVITATION_REFUSALS as readonly string[]).includes(value);
}

/**
 * Ό,τι ξέρει ήδη το βιβλίο του οικοδεσπότη για τον αριθμό μητρώου (persona της επαφής) — **προσυμπλήρωση**,
 * ποτέ δήλωση: δηλώνει **μόνο** ο ίδιος ο επαγγελματίας στην αποδοχή (Ε-4).
 */
export interface CredentialHint {
  readonly number: string | null;
  readonly chapter: string | null;
}

/** Το έγγραφο της πρόσκλησης. */
export interface EngagementInvitation extends InvitationRecordCore {
  /** Ο χώρος **της υπόθεσης** — ο μισθωτής της συμμετοχής που θα γεννηθεί (ADR-862 §2.3 Κ-3). */
  readonly hostCompanyId: string;
  readonly projectId: string;
  readonly caseId: string;
  readonly propertyId: string;
  readonly role: LegalProfessionalRole;
  /** Η επαφή του διορισμού (`ProfessionalsCard`) — γίνεται `origin.contactId` της συμμετοχής. */
  readonly contactId: string;
  /** Οι συναινέσεις που **ήδη** ικανοποιήθηκαν στην έκδοση (Ε-3: καμία πρόσκληση πριν από αυτές). */
  readonly consents: readonly EngagementConsent[];
  readonly credentialHint: CredentialHint;
  /** Ε-5 — πότε ο προσκαλών υπενθυμίζεται αν δεν υπάρξει απάντηση. Γράφεται **στην έκδοση** (προληπτικά). */
  readonly reminderDueAt: string;
  readonly reminderSentAt: string | null;
}

/** Η πρόσκληση της θέσης όπως τη βλέπει ο **οικοδεσπότης** — χωρίς nonce, χωρίς id στο HTML του επαγγελματία. */
export interface CaseInvitationSummary {
  readonly invitationId: string;
  /** **Παρουσιαζόμενη** κατάσταση (`pending` πέρα από τη λήξη ⇒ `expired`, παράγεται). */
  readonly state: InvitationState;
  readonly inviteeEmail: string;
  readonly sentAt: string;
  readonly openedAt: string | null;
  readonly expiresAt: string;
  readonly resolvedAt: string | null;
  readonly reminderSentAt: string | null;
}

/** **Μετρήσεις, όχι έγγραφα** — ό,τι λέει το email και η όψη για το «τι θα βρείτε». */
export interface EngagementInvitationChecklist {
  readonly applicable: number;
  readonly complete: number;
  readonly missing: number;
}

/** Η όψη πριν από την ταυτότητα (`/case-invite/[token]`) — **μετρήσεις, όχι έγγραφα** (ADR-901 §5.3 βήμα 5). */
export interface EngagementInvitationPreview {
  readonly role: LegalProfessionalRole;
  readonly propertyLabel: string | null;
  readonly hostName: string | null;
  readonly expiresAt: string;
  readonly credentialHint: CredentialHint;
  /** Ο κατάλογος **του ρόλου** — πόσα δικαιολογητικά εφαρμόζονται / είναι έτοιμα / λείπουν. `null` ⇒ δεν διαβάστηκε. */
  readonly checklist: EngagementInvitationChecklist | null;
  readonly identityAssurance: 'declared';
}
