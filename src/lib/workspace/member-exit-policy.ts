/**
 * @fileoverview **Η ΚΡΙΣΗ ΤΗΣ ΕΞΟΔΟΥ** — «μπορεί ΑΥΤΗ η θητεία να κλείσει ΤΩΡΑ, από ΑΥΤΟΝ;» (ADR-892 §3.3).
 * @related lib/workspace/end-membership (ο γραφέας) · lib/auth/authority (ο ΕΝΑΣ κριτής ικανότητας)
 * @module lib/workspace/member-exit-policy
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΚΡΙΝΕΤΑΙ ΕΔΩ — ΚΑΙ ΤΙ ΟΧΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το *«έχει ο δρων την εξουσία να διαχειρίζεται μέλη;»* κρίνεται **στο σύνορο** (`withAuth({ permissions:
 * 'users:users:manage' })`, ADR-801 — η ίδια ικανότητα με την πρόσκληση: όποιος βάζει, βγάζει). Εδώ ζουν
 * μόνο οι **αναλλοίωτες δεδομένων**, που κανένα permission δεν μπορεί να απαντήσει:
 *
 *   1. **Υπάρχει ζωντανή θητεία;** — αλλιώς `not-a-member` (ληγμένη ⇒ ιδεμποτικό «τίποτα να κάνω»).
 *   2. **Αφαίρεση του εαυτού σου;** — αυτό είναι *αποχώρηση* (§3.1): άλλη πράξη, άλλο ίχνος, άλλη ειδοποίηση.
 *   3. **Ανώτερος;** — ο δρων δεν βγάζει ρόλο **υψηλότερης** βαθμίδας (ισότιμος επιτρέπεται: GitHub owner
 *      αφαιρεί owner). Βαθμίδα από το **ένα** `compareRoleLevels` — ποτέ `if (role === …)` (CHECK 3.68).
 *   4. **Τελευταίος διαχειριστής;** — γραφείο χωρίς κανέναν που να μπορεί να διαχειριστεί μέλη είναι
 *      **κλειδωμένο για πάντα** (Figma/GitHub: πρώτα μεταβίβαση). «Διαχειριστής» = όποιος κατέχει την ίδια
 *      ικανότητα `users:users:manage` κατά τον `decideCapability` — ισχύει **και** για την αποχώρηση.
 *
 * ⚠️ **ΚΑΘΑΡΗ** — καμία ανάγνωση: ο καλών φέρνει θέση + ενεργά μέλη, ώστε η **ίδια** κρίση να τρέχει στην
 * προεπισκόπηση (dry-run, §3.6) και στην πράξη — ένας υπολογισμός, όχι δύο.
 */

import { decideCapability } from '@/lib/auth/authority';
import { compareRoleLevels, isRoleBypass } from '@/lib/auth/roles';
import { isGranted } from '@/types/capability-authority';
import type { PermissionId } from '@/lib/auth/types';
import { isTenureEnded, type EndedMembershipStatus, type WorkspaceMembership } from '@/types/workspace-membership';

/** Η ικανότητα που **κάνει** κάποιον διαχειριστή μελών — η ίδια που δηλώνει το σύνορο της πρόσκλησης. */
export const MEMBER_MANAGEMENT_PERMISSION: PermissionId = 'users:users:manage';

/** Το όριο του λόγου εξόδου — ελεύθερο κείμενο που ταξιδεύει σε ίχνος και ειδοποίηση· **ένα** για διαδρομή και οθόνη. */
export const MEMBER_EXIT_REASON_MAX = 500;

/**
 * Οι τρεις δρόμοι εξόδου μέλους (η αναστολή λογαριασμού είναι **άλλη** πράξη, πλατφόρμας — §3.1).
 * - `removal` / `departure` — **λήξη** θητείας (`removed` / `left`).
 * - `pause` — παύση πρόσβασης (ADR-892 Φ2β): ο άνθρωπος **μένει μέλος**, `status: 'suspended'`.
 */
export type MemberExitKind = 'removal' | 'departure' | 'pause';

/** Οι δρόμοι που **κλείνουν** τη θητεία — η παύση δεν είναι λήξη και ο τύπος το απαγορεύει. */
export type EndingExitKind = Exclude<MemberExitKind, 'pause'>;

/** Η κατάσταση που γράφει κάθε δρόμος λήξης — **ένας** χάρτης, όχι `if` σε κάθε καλούντα. */
export const ENDING_BY_EXIT_KIND: Readonly<Record<EndingExitKind, EndedMembershipStatus>> = {
  removal: 'removed',
  departure: 'left',
};

/** Κλειστό σύνολο ετυμηγοριών — μόνο η πρώτη επιτρέπει. */
export type MemberExitVerdict =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'not-a-member' }
  | { readonly kind: 'self-removal' }
  | { readonly kind: 'self-pause' }
  | { readonly kind: 'not-self-departure' }
  | { readonly kind: 'outranks-actor' }
  | { readonly kind: 'last-manager' };

export interface MemberExitQuery {
  readonly kind: MemberExitKind;
  readonly actorUid: string;
  /** Ο ρόλος του δρώντος **σε αυτόν τον χώρο** (`null` = απών ρόλος, ADR-853 §14). */
  readonly actorRole: string | null;
  readonly targetUid: string;
  /** Η θέση του στόχου — `null` αν δεν υπάρχει έγγραφο. */
  readonly target: WorkspaceMembership | null;
  /** Τα **ενεργά** μέλη του χώρου (`listActiveWorkspaceMembers`) — η βάση του «τελευταίου». */
  readonly activeMembers: readonly WorkspaceMembership[];
}

/** Κατέχει αυτός ο ρόλος τη διαχείριση μελών; — ο **ένας** κριτής, ποτέ λίστα ρόλων. */
export function managesMembers(globalRole: string): boolean {
  const role = globalRole === '' ? null : globalRole;
  return isGranted(decideCapability({ subject: { globalRole: role }, action: MEMBER_MANAGEMENT_PERMISSION }).verdict);
}

/** Η κρίση — με τη σειρά της κεφαλίδας (η σειρά είναι συμβόλαιο: η πρώτη αποτυχία ονομάζεται). */
export function judgeMemberExit(query: MemberExitQuery): MemberExitVerdict {
  const { target } = query;
  if (target === null || isTenureEnded(target.status)) return { kind: 'not-a-member' };

  // Παύση μόνο σε **ενεργή** πρόσβαση (η ήδη-σε-παύση θέση είναι ιδεμποτία του ενορχηστρωτή, όχι κρίση).
  if (query.kind === 'pause' && target.status !== 'active') return { kind: 'not-a-member' };

  const isSelf = query.actorUid === query.targetUid;
  if (query.kind === 'removal' && isSelf) return { kind: 'self-removal' };
  if (query.kind === 'pause' && isSelf) return { kind: 'self-pause' };
  if (query.kind === 'departure' && !isSelf) return { kind: 'not-self-departure' };

  // Η αποχώρηση είναι του ίδιου· αφαίρεση **και** παύση είναι πράξη διαχειριστή πάνω σε άλλον.
  if (query.kind !== 'departure' && outranks(target.globalRole, query.actorRole)) return { kind: 'outranks-actor' };

  if (isLastManager(query.targetUid, target, query.activeMembers)) return { kind: 'last-manager' };
  return { kind: 'allowed' };
}

/**
 * Είναι ο στόχος **ανώτερης** βαθμίδας από τον δρώντα;
 * 🔑 Ο δρων με παράκαμψη (πλατφόρμα) δεν «υπερέχεται» ποτέ· ο δρων **χωρίς** ρόλο υπερέχεται από όλους
 * (fail-closed: ταυτότητα χωρίς βαθμίδα δεν βγάζει κανέναν).
 */
function outranks(targetRole: string, actorRole: string | null): boolean {
  if (actorRole === null || actorRole === '') return true;
  if (isRoleBypass(actorRole)) return false;
  return compareRoleLevels(targetRole, actorRole) < 0;
}

/** Μετά την έξοδο, μένει **κανένας** ενεργός διαχειριστής μελών; — μόνο αν ο στόχος **είναι** διαχειριστής. */
function isLastManager(
  targetUid: string,
  target: WorkspaceMembership,
  activeMembers: readonly WorkspaceMembership[],
): boolean {
  if (target.status !== 'active' || !managesMembers(target.globalRole)) return false;
  return !activeMembers.some(
    (member) => member.uid !== targetUid && member.status === 'active' && managesMembers(member.globalRole),
  );
}

// =============================================================================
// Η ΕΠΑΝΑΦΟΡΑ ΠΡΟΣΒΑΣΗΣ — ADR-892 Φ2β
// =============================================================================

/** Κλειστό σύνολο — μόνο η πρώτη επιτρέπει. */
export type AccessRestoreVerdict =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'not-a-member' }
  | { readonly kind: 'not-paused' }
  | { readonly kind: 'self-restore' }
  | { readonly kind: 'outranks-actor' };

export interface AccessRestoreQuery {
  readonly actorUid: string;
  readonly actorRole: string | null;
  readonly targetUid: string;
  readonly target: WorkspaceMembership | null;
}

/**
 * «Μπορεί ΑΥΤΟΣ να επαναφέρει ΤΩΡΑ την πρόσβαση;» — κατοπτρική της παύσης: ο ίδιος πίνακας βαθμίδων,
 * **κανένας** έλεγχος «τελευταίου διαχειριστή» (η επαναφορά **προσθέτει** διαχειριστή, δεν αφαιρεί).
 * ⚠️ Ήδη ενεργός ⇒ `not-paused`: ο ενορχηστρωτής το μεταφράζει σε ιδεμποτικό «ήδη ενεργός», όχι σε σφάλμα.
 */
export function judgeAccessRestore(query: AccessRestoreQuery): AccessRestoreVerdict {
  const { target } = query;
  if (target === null || isTenureEnded(target.status)) return { kind: 'not-a-member' };
  if (target.status === 'active') return { kind: 'not-paused' };
  // Εκκρεμής θέση δεν «επαναφέρεται» — δεν υπήρξε ποτέ πρόσβαση για να ξαναδοθεί.
  if (target.status !== 'suspended') return { kind: 'not-a-member' };
  if (query.actorUid === query.targetUid) return { kind: 'self-restore' };
  if (outranks(target.globalRole, query.actorRole)) return { kind: 'outranks-actor' };
  return { kind: 'allowed' };
}
