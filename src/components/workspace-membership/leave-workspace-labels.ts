/**
 * ADR-892 Φ3 — **ΤΑ ΚΛΕΙΔΙΑ ΤΗΣ ΑΠΟΧΩΡΗΣΗΣ**, κυριολεκτικά και σε κλειστούς πίνακες (namespace `common-account`).
 *
 * Ίδιο ιδίωμα με το `member-exit-labels.ts`: κάθε κλειδί γραμμένο **ολόκληρο** (το CHECK 3.8 διαβάζει τιμές
 * σταθερών) και `Record` πάνω στο κλειστό σύνολο των αρνήσεων, ώστε μια **νέα** άρνηση που φτάνει στην
 * αποχώρηση να **μη μεταγλωττίζεται** μέχρι κάποιος να πει τι σημαίνει για τον άνθρωπο.
 *
 * @module components/workspace-membership/leave-workspace-labels
 * @see docs/centralized-systems/reference/adrs/ADR-892-workspace-member-removal.md §13
 */

import type { MemberExitVerdict } from '@/lib/workspace/member-exit-policy';

export const LEAVE_WORKSPACE_KEYS = {
  menuItem: 'userMenu.spaces.leave',
  officeQuoted: 'workspaceLeave.officeQuoted',
  officeUnnamed: 'workspaceLeave.officeUnnamed',
  title: 'workspaceLeave.title',
  description: 'workspaceLeave.description',
  loading: 'workspaceLeave.loading',
  previewFailed: 'workspaceLeave.previewFailed',
  retry: 'workspaceLeave.retry',
  cancel: 'workspaceLeave.cancel',
  consequencesHeading: 'workspaceLeave.consequencesHeading',
  losesAccess: 'workspaceLeave.losesAccess',
  contributionsStay: 'workspaceLeave.contributionsStay',
  noActTeams: 'workspaceLeave.noActTeams',
  actTeamsTo: 'workspaceLeave.actTeamsTo',
  actTeamsOrphaned: 'workspaceLeave.actTeamsOrphaned',
  homeContinues: 'workspaceLeave.homeContinues',
  staysSignedIn: 'workspaceLeave.staysSignedIn',
  unaffected: 'workspaceLeave.unaffected',
  rejoin: 'workspaceLeave.rejoin',
  confirm: 'workspaceLeave.confirm',
  leaving: 'workspaceLeave.leaving',
  manageRoles: 'workspaceLeave.manageRoles',
  failed: 'workspaceLeave.failed',
  left: 'workspaceLeave.left',
  signInAgain: 'workspaceLeave.signInAgain',
} as const;

/**
 * Οι αρνήσεις που **φτάνουν** στην αποχώρηση: ο στόχος είναι πάντα ο καλών (άρα όχι `not-self-departure`) και
 * η αποχώρηση δεν κρίνει βαθμίδα (άρα όχι `outranks-actor`). Λόγος εκτός συνόλου ⇒ «απέτυχε», ποτέ μαντεψιά.
 */
export type LeaveRefusal = Extract<MemberExitVerdict['kind'], 'not-a-member' | 'last-manager'>;

export const LEAVE_REFUSAL_KEY: Readonly<Record<LeaveRefusal, string>> = {
  'not-a-member': 'workspaceLeave.refused.notAMember',
  'last-manager': 'workspaceLeave.refused.lastManager',
};

/** Είναι αυτή η ετυμηγορία μία από όσες ξέρουμε να πούμε στον αποχωρούντα; — φρουρός τύπου, όχι cast. */
export function isLeaveRefusal(kind: string): kind is LeaveRefusal {
  return Object.hasOwn(LEAVE_REFUSAL_KEY, kind);
}

/** Το κλειστό σύνολο, για ανάγνωση του `reason` της 409 — παράγεται, δεν ξαναγράφεται. */
export const LEAVE_REFUSALS = Object.keys(LEAVE_REFUSAL_KEY) as readonly LeaveRefusal[];
