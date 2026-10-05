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

/** Τα γραφεία όπου ο άνθρωπος **ανήκει** — ή «δεν μπόρεσα να ρωτήσω» (ποτέ κενή λίστα στη θέση του). */
export type BelongingOffices =
  | { readonly outcome: 'ok'; readonly companyIds: readonly string[] }
  | { readonly outcome: 'unknown' };

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
