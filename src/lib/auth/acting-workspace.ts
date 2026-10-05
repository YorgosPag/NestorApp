/**
 * =============================================================================
 * «ΓΙΑ ΛΟΓΑΡΙΑΣΜΟ ΠΟΙΟΥ ΧΩΡΟΥ ΑΝΑΛΑΜΒΑΝΕΙΣ;» — ο κριτής της ιδιότητας (ADR-901 §15.6.2 · Γ1)
 * =============================================================================
 *
 * Όποιος αναλαμβάνει υπόθεση ενεργεί **επαγγελματικά** ⇒ η υπόθεση ανήκει στο **γραφείο** του, ακόμη κι αν
 * δουλεύει μόνος. Ο προσωπικός χώρος είναι **προσωρινό** σπίτι, μόνο για όποιον δεν έχει ακόμη γραφείο (Α1).
 *
 * | Γραφεία όπου **ανήκει** | Αίτημα πελάτη | Ετυμηγορία |
 * |---|---|---|
 * | άγνωστο («δεν μπόρεσα να ρωτήσω») | οτιδήποτε | `unknown` — **ποτέ** σιωπηλά προσωπικός (Α43) |
 * | οποιαδήποτε | γραφείο όπου **δεν** ανήκει | `refused` · `not-a-member` (Α42) |
 * | 1+ | «προσωπικά» | `refused` · `personal-with-office` (Α1γ · Α40) |
 * | 0 | κανένα · «προσωπικά» | `personal-provisional` |
 * | 1 | κανένα · το ίδιο | `office` — αυτόματα |
 * | 2+ | κανένα | `choice-required` — **καμία γραφή** (Α41) |
 * | 2+ | ένα από αυτά | `office` |
 *
 * 🔑 **Η άρνηση προηγείται της αυτόματης επιλογής**: άνθρωπος με **ένα** γραφείο που ζητά **άλλο** παίρνει άρνηση,
 *    όχι το δικό του — αλλιώς θα γραφόταν χώρος **διαφορετικός** από αυτόν που ονόμασε (Α1δ «ποτέ σιωπηλά»).
 * 🔑 **«Ανήκει» ≠ «επιτρέπεται»**: τη λίστα τη δίνει ο `listOwnWorkspaces` (`belongsHere`) — ο super admin που
 *    **περνά** από ξένο γραφείο δεν αναλαμβάνει για λογαριασμό του.
 * ⛔ **Δεν αποφασίζει πρόσβαση**: το `decideEngagement` μένει `engagement.uid === uid`. Εδώ κρίνεται μόνο
 *    «πού φαίνεται» η υπόθεση.
 *
 * Καθαρό — καμία ανάγνωση, κανένα `server-only`: το ασκούν οι άγκυρες χωρίς βάση, και ο πελάτης μοιράζεται το σχήμα.
 *
 * @module lib/auth/acting-workspace
 * @see lib/auth/workspace-membership — `listOwnWorkspaces` («τα γραφεία όπου ανήκω»)
 * @see lib/auth/engagement-write — ο ΕΝΑΣ γραφέας (η αποδοχή **φέρει** το αποτέλεσμα)
 */

import { z } from 'zod';

import type { Engagement } from '@/types/engagement';
import {
  orgWorkspace,
  personalWorkspace,
  workspaceRefKey,
  type OrgWorkspaceRef,
  type PersonalWorkspaceRef,
  type RequestedWorkspace,
  type WorkspaceRef,
} from '@/types/workspace-membership';

// =============================================================================
// Η ΜΙΑ ΕΡΜΗΝΕΙΑ ΤΗΣ ΑΠΟΥΣΙΑΣ (ADR-901 §15.7 · άγκυρα Α48)
// =============================================================================

/**
 * **Για λογαριασμό ποιου χώρου ενεργεί αυτή η συμμετοχή.** Απόν πεδίο ⇒ ο προσωπικός χώρος του ίδιου — ακριβώς
 * ό,τι θα έγραφε η αποδοχή για άνθρωπο χωρίς γραφείο. Γι' αυτό **δεν** χρειάστηκε backfill.
 *
 * ⛔ **Το ΜΟΝΟ σημείο που διαβάζει `engagement.actingFor`.** Δεύτερη ερμηνεία της απουσίας = δύο απαντήσεις.
 */
export function actingWorkspaceOf(engagement: Pick<Engagement, 'uid' | 'actingFor'>): WorkspaceRef {
  return engagement.actingFor ?? personalWorkspace(engagement.uid);
}

/** Τα γραφεία όπου ο άνθρωπος **ανήκει** — ή «δεν μπόρεσα να ρωτήσω» (ποτέ κενή λίστα στη θέση του). */
export type BelongingOffices =
  | { readonly outcome: 'ok'; readonly companyIds: readonly string[] }
  | { readonly outcome: 'unknown' };

/**
 * **Το σπίτι όπου ΦΑΙΝΕΤΑΙ μια συμμετοχή** — ή «δεν μπόρεσα να ρωτήσω» (ADR-901 §15.15 · Γ2.1).
 * `departedFrom` ≠ `null` ⇒ ανελήφθη για γραφείο όπου ο άνθρωπος **δεν ανήκει πια**: η πόρτα του είναι ο προσωπικός.
 */
export type CasePlacement =
  | { readonly outcome: 'placed'; readonly home: WorkspaceRef; readonly departedFrom: OrgWorkspaceRef | null }
  | { readonly outcome: 'unknown' };

/**
 * **Πού ανοίγει ΤΩΡΑ αυτή η συμμετοχή, για ΑΥΤΟΝ τον άνθρωπο;** (ADR-901 §15.15 · Γ2.1 · Ε-10 «κρατά»)
 *
 * | Ενεργεί για ({@link actingWorkspaceOf}) | Ανήκει ακόμη εκεί; | Σπίτι |
 * |---|---|---|
 * | προσωπικό χώρο | — (δεν ρωτιέται) | ο προσωπικός |
 * | γραφείο | ναι | το γραφείο |
 * | γραφείο | **όχι** | ο **προσωπικός**, με `departedFrom` = το γραφείο |
 * | γραφείο | «δεν μπόρεσα να ρωτήσω» | `unknown` — **ποτέ** σιωπηλά το ένα ή το άλλο |
 *
 * 🔑 **Υπολογίζεται, δεν γράφεται**: το `actingFor` μένει το **γεγονός** («ανελήφθη για το Γραφείο Α»)· το σπίτι
 *    είναι **όψη** του, τώρα. Γι' αυτό η επιστροφή στο γραφείο φέρνει την υπόθεση πίσω **χωρίς** καμία πράξη και
 *    χωρίς προθεσμία — και η διαδοχή (Γ6) βρίσκει το πεδίο ανέγγιχτο.
 * ⛔ **Δεν αποφασίζει πρόσβαση** (Α39): η πρόσβαση μένει `engagement.uid === uid`. Εδώ κρίνεται μόνο η **πόρτα**.
 * ⚠️ `offices` = όπου **ανήκει** (`belonging`), όχι όπου **περνά** (`reachable`).
 */
export function placementOf(engagement: Pick<Engagement, 'uid' | 'actingFor'>, offices: BelongingOffices): CasePlacement {
  const acting = actingWorkspaceOf(engagement);
  if (acting.kind === 'personal') return { outcome: 'placed', home: acting, departedFrom: null };
  if (offices.outcome === 'unknown') return { outcome: 'unknown' };
  return offices.companyIds.includes(acting.companyId)
    ? { outcome: 'placed', home: acting, departedFrom: null }
    : { outcome: 'placed', home: personalWorkspace(engagement.uid), departedFrom: acting };
}

/**
 * **Φαίνεται αυτή η συμμετοχή στη λίστα αυτού του χώρου;** (ADR-901 §15.6.3 · Α6 · άγκυρα Α47)
 *
 * | Συμμετοχή | Πού φαίνεται |
 * |---|---|
 * | πρόταση που **περιμένει απάντηση** (`offered`) | **παντού** — δεν έχει ακόμη χώρο, ανήκει στον άνθρωπο |
 * | κάθε άλλη | **μόνο** στο **σπίτι** της (`home` — {@link placementOf}) |
 *
 * 🔑 **Μία λίστα, φίλτρο ο χώρος** (Α6): ίδιο ερώτημα (`uid`), ίδιος κώδικας — κανένας νέος δείκτης.
 * ⛔ **Δεν αποφασίζει πρόσβαση.** Ο χώρος εδώ είναι ο χώρος **της σελίδας**· το «ποιος βλέπει» μένει
 *    `decideEngagement` (`engagement.uid === uid`). Διαχειριστής γραφείου **δεν** βλέπει υπόθεση συναδέλφου επειδή
 *    κοιτά τη λίστα του γραφείου: η λίστα είναι ήδη **μόνο** οι δικές του συμμετοχές.
 * ⚠️ Συμμετοχή που **δεν αναλήφθηκε ποτέ** και δεν περιμένει πια (`declined` · `expired` · `withdrawn`) δεν έχει
 *    χώρο ⇒ διαβάζεται προσωπική, όπως κάθε απουσία (Α48). Δηλωμένο όριο — ADR-901 §15.14.
 */
export function isShownInWorkspace(engagement: Pick<Engagement, 'state'>, home: WorkspaceRef, viewed: WorkspaceRef): boolean {
  if (engagement.state === 'offered') return true;
  return workspaceRefKey(home) === workspaceRefKey(viewed);
}

/** Η δήλωση ανήκει **στον ίδιο**: γραφείο, ή ο **δικός του** προσωπικός χώρος — ποτέ ξένος (ζώνη του γραφέα). */
export function isOwnActingWorkspace(uid: string, workspace: WorkspaceRef): boolean {
  return workspace.kind === 'org' || workspace.userId === uid;
}

// =============================================================================
// ΤΟ ΣΥΡΜΑ — το πολύ ΕΝΑ αίτημα, χωρίς `userId`
// =============================================================================

/**
 * Ο χώρος που **ζητά** ο πελάτης στην αποδοχή — ο υπάρχων `RequestedWorkspace`, χωρίς το `default`
 * («δεν ζητώ τίποτα» = το πεδίο **λείπει**). ⚠️ **Αίτημα, όχι άδεια**: το κρίνει ο διακομιστής.
 */
export type ActingWorkspaceRequest = Exclude<RequestedWorkspace, { readonly kind: 'default' }>;

/** Το ΕΝΑ σχήμα και για τις δύο πόρτες («Αναλαμβάνω» · σύνδεσμος email). */
export const ACTING_WORKSPACE_REQUEST_SCHEMA = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('org'), companyId: z.string().trim().min(1).max(128) }).strict(),
  z.object({ kind: z.literal('personal') }).strict(),
]);

// =============================================================================
// Η ΕΤΥΜΗΓΟΡΙΑ — ονομασμένη, ποτέ boolean
// =============================================================================

export const ACTING_WORKSPACE_VERDICTS = ['office', 'personal-provisional', 'choice-required', 'refused', 'unknown'] as const;
export type ActingWorkspaceVerdict = (typeof ACTING_WORKSPACE_VERDICTS)[number];

/** Γιατί αρνήθηκε — δύο λόγοι, δύο θεραπείες. */
export type ActingWorkspaceRefusal = 'not-a-member' | 'personal-with-office';

export type ActingWorkspaceDecision =
  | { readonly verdict: 'office'; readonly workspace: OrgWorkspaceRef }
  | { readonly verdict: 'personal-provisional'; readonly workspace: PersonalWorkspaceRef }
  /** 2+ γραφεία χωρίς επιλογή — τα γραφεία επιστρέφονται ώστε η οθόνη να ρωτήσει. **Καμία γραφή.** */
  | { readonly verdict: 'choice-required'; readonly offices: readonly string[] }
  | { readonly verdict: 'refused'; readonly reason: ActingWorkspaceRefusal }
  | { readonly verdict: 'unknown' };

export interface ActingWorkspaceQuery {
  /** Ο άνθρωπος, από το υπογεγραμμένο token. */
  readonly uid: string;
  readonly offices: BelongingOffices;
  /** `null` ⇒ ο πελάτης δεν ζήτησε χώρο. */
  readonly requested: ActingWorkspaceRequest | null;
}

export function decideActingWorkspace(query: ActingWorkspaceQuery): ActingWorkspaceDecision {
  const { uid, offices, requested } = query;
  if (offices.outcome === 'unknown') return { verdict: 'unknown' };
  const mine = [...new Set(offices.companyIds)];

  if (requested?.kind === 'org') {
    return mine.includes(requested.companyId)
      ? { verdict: 'office', workspace: orgWorkspace(requested.companyId) }
      : { verdict: 'refused', reason: 'not-a-member' };
  }
  if (mine.length === 0) return { verdict: 'personal-provisional', workspace: personalWorkspace(uid) };
  if (requested?.kind === 'personal') return { verdict: 'refused', reason: 'personal-with-office' };
  if (mine.length === 1) return { verdict: 'office', workspace: orgWorkspace(mine[0]) };
  return { verdict: 'choice-required', offices: mine };
}
