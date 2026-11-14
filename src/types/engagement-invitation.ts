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

import type { IssuerQualification } from '@/config/document-validity/document-issuers';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { RegistryAuthorityId } from '@/constants/professional-registries';
import type {
  ConveyanceEngagementSubject,
  EngagementConsent,
  IssuanceEngagementRole,
  IssuanceEngagementSubject,
} from '@/types/engagement';
import { CORE_INVITATION_REFUSALS, type InvitationRecordCore, type InvitationState } from '@/types/invitation-core';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

/**
 * Οι αρνήσεις **του είδους** — κρίνονται μέσα στη συναλλαγή της αποδοχής· η πρόσκληση μένει `pending`.
 * - `slot-occupied` — η θέση έχει πια **άλλον** ζωντανό επαγγελματία.
 * - `role-conflict` — ο ίδιος άνθρωπος έχει ήδη **άλλη** θέση στην υπόθεση.
 * - `case-closed`   — η υπόθεση έκλεισε/ακυρώθηκε μετά την έκδοση.
 *
 * ADR-901 §15 (Γ1) — «για λογαριασμό ποιου γραφείου»: κρίνονται **πριν** από τη συναλλαγή (ίδιος κριτής με το
 * «Αναλαμβάνω»)· η πρόσκληση μένει `pending`, ο άνθρωπος διορθώνει και ξαναπατά.
 * - `acting-choice-required` — ανήκει σε 2+ γραφεία και δεν διάλεξε.
 * - `acting-refused`         — ζήτησε γραφείο όπου δεν ανήκει, ή «προσωπικά» ενώ έχει γραφείο.
 */
export const ENGAGEMENT_INVITATION_KIND_REFUSALS = [
  'slot-occupied', 'role-conflict', 'case-closed', 'acting-choice-required', 'acting-refused',
] as const;
export type EngagementInvitationKindRefusal = (typeof ENGAGEMENT_INVITATION_KIND_REFUSALS)[number];

export const ENGAGEMENT_INVITATION_REFUSALS = [...CORE_INVITATION_REFUSALS, ...ENGAGEMENT_INVITATION_KIND_REFUSALS] as const;
export type EngagementInvitationRefusal = (typeof ENGAGEMENT_INVITATION_REFUSALS)[number];

/**
 * Ό,τι ξέρει ήδη το βιβλίο του οικοδεσπότη για τον αριθμό μητρώου (persona της επαφής) — **προσυμπλήρωση**,
 * ποτέ δήλωση: δηλώνει **μόνο** ο ίδιος ο επαγγελματίας στην αποδοχή (Ε-4).
 */
export interface CredentialHint {
  readonly number: string | null;
  readonly chapter: string | null;
}

/**
 * Ό,τι κοινό έχει **κάθε** πρόσκληση συμμετοχής, όποιου είδους υπόθεσης (ADR-862 §5.3.11).
 *
 * 🔑 **Μία μηχανή, δύο είδη υπόθεσης** — ίδια συλλογή, ίδιο μυστικό, ίδια σελίδα `/case-invite/[token]`, ίδια
 * εξαργύρωση. Ό,τι διαφέρει ανά είδος το απαντά **μόνο** ο οικοδεσπότης του είδους (`server/engagements/engagement-hosts.ts`).
 */
interface EngagementInvitationBase extends InvitationRecordCore {
  /** Ο χώρος **της υπόθεσης** — ο μισθωτής της συμμετοχής που θα γεννηθεί (ADR-862 §2.3 Κ-3). */
  readonly hostCompanyId: string;
  readonly projectId: string;
  readonly propertyId: string;
  /** Η επαφή του διορισμού (`ProfessionalsCard`) — γίνεται `origin.contactId` της συμμετοχής. */
  readonly contactId: string;
  /** Οι συναινέσεις που **ήδη** ικανοποιήθηκαν στην έκδοση (Ε-3: καμία πρόσκληση πριν από αυτές). */
  readonly consents: readonly EngagementConsent[];
  readonly credentialHint: CredentialHint;
  /** Ε-5 — πότε ο προσκαλών υπενθυμίζεται αν δεν υπάρξει απάντηση. Γράφεται **στην έκδοση** (προληπτικά). */
  readonly reminderDueAt: string;
  readonly reminderSentAt: string | null;
}

/**
 * Πρόσκληση σε **υπόθεση μεταβίβασης** (ADR-901 Φ3). Στον δίσκο ζει όπως πάντα, με επίπεδο `caseId`
 * (καμία μετανάστευση). Το `subject` το **παράγει** το σχήμα στην ανάγνωση.
 */
export interface ConveyanceEngagementInvitation extends EngagementInvitationBase {
  readonly subject: ConveyanceEngagementSubject;
  readonly caseId: string;
  readonly role: LegalProfessionalRole;
}

/**
 * Πρόσκληση στον **χώρο μιας ανάθεσης έκδοσης** (ADR-915 §39 · ADR-862 §5.3.11). Γεννιέται από το «Αναλαμβάνω»
 * του επαγγελματία, δεμένη στο email όπου πήγε η ανάθεση. Στον δίσκο ζει με `subject` (το ίδιο σχήμα με τη συμμετοχή).
 */
export interface IssuanceEngagementInvitation extends EngagementInvitationBase {
  readonly subject: IssuanceEngagementSubject;
  readonly role: IssuanceEngagementRole;
  /** Το είδος εγγράφου της ανάθεσης — από εδώ παράγεται η αρχή του μητρώου (προσόν → άδεια → αρχή). */
  readonly documentKind: DocumentKind;
  /** Το προσόν που κατέγραψε το γραφείο στην ανάθεση — διαλέγει το μητρώο, ποτέ ο άνθρωπος. */
  readonly qualification: IssuerQualification;
}

/** Το έγγραφο της πρόσκλησης — διακριτή ένωση στο `subject.kind`. */
export type EngagementInvitation = ConveyanceEngagementInvitation | IssuanceEngagementInvitation;

/** Φρουροί — ο ΕΝΑΣ τρόπος να στενέψει μια πρόσκληση. */
export function isConveyanceInvitation(invitation: EngagementInvitation): invitation is ConveyanceEngagementInvitation {
  return invitation.subject.kind === 'conveyance_case';
}
export function isIssuanceInvitation(invitation: EngagementInvitation): invitation is IssuanceEngagementInvitation {
  return invitation.subject.kind === 'document_issuance';
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

/**
 * **Σε τι** καλείται ο άνθρωπος — ό,τι διαφέρει ανά είδος υπόθεσης στην όψη και στο email (ADR-862 §5.3.11).
 * - μεταβίβαση: ο νομικός ρόλος + ο κατάλογος **του ρόλου** (μετρήσεις· `null` ⇒ δεν διαβάστηκε)
 * - ανάθεση έκδοσης: **ποιο** έγγραφο ζητείται (π.χ. ΠΕΑ)
 */
export type EngagementInvitationSubjectView =
  | {
      readonly kind: 'conveyance_case';
      readonly role: LegalProfessionalRole;
      readonly checklist: EngagementInvitationChecklist | null;
    }
  | { readonly kind: 'document_issuance'; readonly documentKind: DocumentKind };

/** Η όψη πριν από την ταυτότητα (`/case-invite/[token]`) — **μετρήσεις, όχι έγγραφα** (ADR-901 §5.3 βήμα 5). */
export interface EngagementInvitationPreview {
  readonly propertyLabel: string | null;
  readonly hostName: string | null;
  readonly subject: EngagementInvitationSubjectView;
  readonly expiresAt: string;
  readonly credentialHint: CredentialHint;
  /** Το μητρώο όπου δηλώνεται ο αριθμός — το παράγει η υπόθεση, **ποτέ** ο άνθρωπος (Ε-4). */
  readonly credentialAuthority: RegistryAuthorityId;
  readonly identityAssurance: 'declared';
}

/** Η **μία** περιγραφή — για όψη **και** email (ποτέ δύο αναγνώσεις που μπορεί να διαφωνήσουν). */
export type EngagementInvitationDescription = Pick<EngagementInvitationPreview, 'propertyLabel' | 'hostName' | 'subject'>;
