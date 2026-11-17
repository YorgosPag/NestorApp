/**
 * @fileoverview **«ΠΟΙΟΣ ΒΛΕΠΕΙ ΤΟΝ ΦΑΚΕΛΟ ΜΟΥ;»** — η όψη πρόσβασης του κατόχου (ADR-916 Φ-Ε1 Σ2).
 * @module types/dossier-access
 * @related `types/conveyance-case.ts` (`CaseProfessionalSlot` — το ίδιο σχήμα «θέση ανά ρόλο» στη μεταβίβαση)
 *
 * 🔑 **Μία θέση ανά ρόλο** (ένας ζωντανός ανά ρόλο, ADR-916 §5.26): η τρέχουσα συμμετοχή (`selectCurrentEngagement`)
 *    **και** η πιο πρόσφατη πρόσκληση — ίδιο σχήμα με τις θέσεις της μεταβίβασης, ώστε η όψη να μη μαντεύει.
 * 🔑 Η **κρίση** (`verdict`) έρχεται από τον ΕΝΑ κριτή (`decideEngagement`): «ενεργή» στη βάση με περασμένη λήξη
 *    λέγεται `expired` εδώ — η όψη ποτέ δεν συγκρίνει ημερομηνίες μόνη της.
 */

import type { DossierShareDays } from '@/config/engagement-policy';
import type { InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import type {
  DeclaredCredential,
  DossierEngagementRole,
  DossierShareReach,
  EngagementState,
  EngagementVerdict,
} from '@/types/engagement';
import type { CaseInvitationSummary } from '@/types/engagement-invitation';
import type { EngagedDossierFile } from '@/types/my-engagements';

/**
 * Οι κωδικοί άρνησης των πορτών πρόσβασης — **κλειστό** σύνολο, το ΕΝΑ λεξιλόγιο για πόρτα (`{ error }`) και πελάτη
 * (`dossierAccessRejectionOf`). 404 = «δεν υπάρχει εδώ» · 409 = «υπάρχει, αλλά η κατάστασή του δεν το επιτρέπει».
 */
export const DOSSIER_ACCESS_ERRORS = ['NOT_FOUND', 'DOSSIER_ARCHIVED', 'SLOT_OCCUPIED', 'NOT_ALLOWED'] as const;
export type DossierAccessError = (typeof DOSSIER_ACCESS_ERRORS)[number];

/** Μία συμμετοχή στον φάκελο, όπως τη βλέπει ο **κάτοχος**. ⛔ Κανένα `uid` — ο κάτοχος βλέπει email, όχι ταυτότητα. */
export interface DossierEngagementSummary {
  readonly engagementId: string;
  readonly role: DossierEngagementRole;
  readonly state: EngagementState;
  /** Η κρίση **τώρα** (λήξη · ανάκληση) — από τον ΕΝΑ κριτή. */
  readonly verdict: EngagementVerdict;
  readonly email: string;
  readonly reach: DossierShareReach;
  readonly shareDays: DossierShareDays;
  readonly offeredAt: string;
  readonly respondedAt: string | null;
  readonly closedAt: string | null;
  readonly expiresAt: string;
  /** Η ιδιότητα όπως τη **δήλωσε** ο επαγγελματίας στην αποδοχή — «(δηλωμένο)». */
  readonly declaredCredential: DeclaredCredential | null;
}

/** Μία **θέση** του φακέλου: ο ρόλος, η τρέχουσα συμμετοχή του και η πιο πρόσφατη πρόσκληση. */
export interface DossierAccessSlot {
  readonly role: DossierEngagementRole;
  readonly engagement: DossierEngagementSummary | null;
  readonly invitation: CaseInvitationSummary | null;
}

/** Η απάντηση κάθε πόρτας πρόσβασης — πάντα **όλες** οι θέσεις, ώστε η όψη να ξαναζωγραφίζει από μία αλήθεια. */
export interface DossierAccessResponse {
  readonly slots: readonly DossierAccessSlot[];
  /**
   * Μόνο στην **ανάγνωση** (`GET`): τα αρχεία του φακέλου με την καρτέλα τους, από τον ΕΝΑ κριτή της πόρτας — για την
   * προεπισκόπηση «θα δει N αρχεία» και τις εξαιρέσεις. Το σχήμα της όψης του επαγγελματία (`EngagedDossierFile`).
   */
  readonly files?: readonly EngagedDossierFile[];
  /** Μόνο στην έκδοση πρόσκλησης: η έκβαση της **αποστολής** του email, ονομασμένη (ποτέ σιωπή). */
  readonly invited?: InvitationNoticeOutcome;
}
