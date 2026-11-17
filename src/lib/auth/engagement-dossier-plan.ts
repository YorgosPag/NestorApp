/**
 * =============================================================================
 * ΣΥΜΜΕΤΟΧΗ ΣΤΟΝ ΦΑΚΕΛΟ ΙΔΙΩΤΗ — οι ΚΑΘΑΡΟΙ σχεδιασμοί του γραφέα (ADR-916 Φ-Ε1)
 * =============================================================================
 *
 * ⚠️ **Δεν γράφει τίποτα.** Ο ΕΝΑΣ γραφέας μένει το `engagement-write.ts` (συναλλαγή · σήμα · εγγραφή)· εδώ ζουν μόνο
 * οι αποφάσεις «τι θα γραφτεί» για το είδος `property_dossier`, χωρισμένες για το όριο μεγέθους (N.7.1) — και
 * επειδή ασκούνται από τις άγκυρες χωρίς βάση.
 *
 * 🔑 Η λήξη **παράγεται** από τη διάρκεια που διάλεξε ο κάτοχος (`config/engagement-policy.ts`, κλειστό μενού) — ποτέ
 *    πληκτρολογημένη (ADR-862 §5.3.3). Ανανέωση = νέα διάρκεια **από σήμερα**, μόνο σε ενεργή· ποτέ ανάσταση.
 *
 * @module lib/auth/engagement-dossier-plan
 * @see lib/auth/engagement-write — ο γραφέας
 */

import { dossierShareExpiresAt, type DossierShareDays } from '@/config/engagement-policy';
import { generateEngagementId } from '@/services/enterprise-id.service';
import type { WorkspaceRef } from '@/types/workspace-membership';
import {
  LIVE_ENGAGEMENT_STATES,
  SCOPE_OF_SUBJECT,
  TEMPLATE_OF_SUBJECT,
  isDossierEngagement,
  type DeclaredCredential,
  type DossierEngagement,
  type DossierEngagementRole,
  type DossierEngagementSubject,
  type DossierShareReach,
  type Engagement,
} from '@/types/engagement';

/**
 * Αποδοχή πρόσκλησης στον **φάκελο ιδιώτη**. Εύρος και διάρκεια έρχονται **από την πρόσκληση** (τα διάλεξε ο κάτοχος
 * στην έκδοση)· ο οικοδεσπότης δεν μεταφέρεται — είναι ο γονέας της διαδρομής.
 */
export interface DossierInvitationAcceptance {
  readonly subject: DossierEngagementSubject;
  readonly role: DossierEngagementRole;
  readonly uid: string;
  readonly email: string;
  readonly invitationId: string;
  readonly declaredCredential: DeclaredCredential;
  /** ADR-901 §15 — για λογαριασμό ποιου χώρου· κρίθηκε **πριν** από τη συναλλαγή (`decideActingWorkspace`). */
  readonly actingFor: WorkspaceRef;
  readonly reach: DossierShareReach;
  readonly shareDays: DossierShareDays;
  /** Ο κάτοχος που **εξέδωσε** την πρόσκληση. */
  readonly offeredBy: string;
  readonly nowMs: number;
}

/** Αντίγραφο του εύρους — ποτέ αναφορά στο αντικείμενο του καλούντα μέσα στο έγγραφο. */
function copyReach(reach: DossierShareReach): DossierShareReach {
  return { tabs: [...reach.tabs], excludedFileIds: [...reach.excludedFileIds] };
}

/**
 * Η συμμετοχή φακέλου γεννιέται **ήδη ενεργή** από την αποδοχή (ο κάτοχος την πρότεινε με την πρόσκληση, ο
 * επαγγελματίας τη δέχτηκε με το κλικ). Πρότυπο και εύρος CDE **παράγονται** από το είδος· η λήξη μετρά **από την
 * αποδοχή** — η πρόσβαση δεν «τρώγεται» όσο η πρόσκληση περίμενε.
 */
export function activeDossierByInvitation(request: DossierInvitationAcceptance): DossierEngagement {
  const now = new Date(request.nowMs).toISOString();
  return {
    id: generateEngagementId(),
    subject: { kind: 'property_dossier', dossierId: request.subject.dossierId },
    role: request.role,
    uid: request.uid,
    email: request.email,
    template: TEMPLATE_OF_SUBJECT.property_dossier,
    scopes: [SCOPE_OF_SUBJECT.property_dossier],
    state: 'active',
    expiresAt: dossierShareExpiresAt(request.shareDays, request.nowMs),
    origin: { kind: 'owner_invitation', invitationId: request.invitationId },
    reach: copyReach(request.reach),
    shareDays: request.shareDays,
    consents: [],
    declaredCredential: request.declaredCredential,
    actingFor: request.actingFor,
    offeredBy: request.offeredBy,
    offeredAt: now,
    respondedAt: now,
    revokedBy: null,
    closedAt: null,
    updatedAt: now,
  };
}

/** Πράξη του κατόχου πάνω σε συμμετοχή φακέλου. */
export type DossierChange =
  | { readonly kind: 'renew'; readonly shareDays: DossierShareDays }
  | { readonly kind: 'reach'; readonly reach: DossierShareReach };

export type DossierChangePlan =
  | { readonly outcome: 'changed'; readonly before: Engagement; readonly after: DossierEngagement }
  | { readonly outcome: 'noop' | 'not-allowed'; readonly engagement: Engagement };

function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

/**
 * Ανανέωση / αλλαγή εύρους. Άλλο είδος ⇒ `not-allowed` (η λήξη υπόθεσης γραφείου **παράγεται** από την πράξη της,
 * δεν «ανανεώνεται»). Ίδια τιμή ⇒ `noop` (ιδεμποτησία — κανένα ίχνος χωρίς αλλαγή).
 */
export function planDossierChange(e: Engagement, change: DossierChange, nowMs: number): DossierChangePlan {
  if (!isDossierEngagement(e)) return { outcome: 'not-allowed', engagement: e };
  const updatedAt = new Date(nowMs).toISOString();
  if (change.kind === 'renew') {
    if (e.state !== 'active') return { outcome: 'not-allowed', engagement: e };
    const expiresAt = dossierShareExpiresAt(change.shareDays, nowMs);
    return { outcome: 'changed', before: e, after: { ...e, shareDays: change.shareDays, expiresAt, updatedAt } };
  }
  if (!LIVE_ENGAGEMENT_STATES.includes(e.state)) return { outcome: 'not-allowed', engagement: e };
  const unchanged = sameMembers(e.reach.tabs, change.reach.tabs)
    && sameMembers(e.reach.excludedFileIds, change.reach.excludedFileIds);
  if (unchanged) return { outcome: 'noop', engagement: e };
  return { outcome: 'changed', before: e, after: { ...e, reach: copyReach(change.reach), updatedAt } };
}
