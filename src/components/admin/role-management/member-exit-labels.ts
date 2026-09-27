/**
 * ADR-892 Φ2 / Φ2β — **ΤΑ ΚΛΕΙΔΙΑ ΤΗΣ ΑΦΑΙΡΕΣΗΣ, ΤΗΣ ΠΑΥΣΗΣ ΚΑΙ ΤΗΣ ΕΠΑΝΑΦΟΡΑΣ**, κυριολεκτικά και σε κλειστούς πίνακες.
 *
 * Ίδιο ιδίωμα με το `invite-labels.ts`: κάθε κλειδί γραμμένο **ολόκληρο** (το CHECK 3.8 διαβάζει
 * τιμές σταθερών — ένα `t(\`…${kind}\`)` του είναι αόρατο) και `Record` πάνω στο κλειστό σύνολο
 * των αρνήσεων και των δρόμων, ώστε μια **νέα** άρνηση ή ένας **νέος** δρόμος να **μη μεταγλωττίζεται**
 * μέχρι κάποιος να πει τι σημαίνει για τον άνθρωπο.
 *
 * @module components/admin/role-management/member-exit-labels
 * @see docs/centralized-systems/reference/adrs/ADR-892-workspace-member-removal.md §11 · §12
 */

import type { AccessRestoreVerdict, MemberExitVerdict } from '@/lib/workspace/member-exit-policy';

/** Κάθε άρνηση των δύο κριτών — ό,τι **δεν** είναι `allowed` (και όχι το ιδεμποτικό `not-paused`). */
export type MemberExitRefusal =
  | Exclude<MemberExitVerdict, { readonly kind: 'allowed' }>['kind']
  | Exclude<AccessRestoreVerdict, { readonly kind: 'allowed' } | { readonly kind: 'not-paused' }>['kind'];

/**
 * Το namespace των κειμένων — **ΔΙΚΟ** τους, όχι το `admin` (CHECK 3.34 / ADR-744: το `admin` ταξιδεύει ολόκληρο
 * σε κάθε διαδρομή και ξεπέρασε το ταβάνι του). Τα κλειδιά κουβαλούν το πρόθεμα `admin-member-exit:`, άρα κάθε
 * καταναλωτής ζητά `useTranslation(['admin', MEMBER_EXIT_NS])` για να φορτωθεί.
 */
export const MEMBER_EXIT_NS = 'admin-member-exit';

/** Οι δύο δρόμοι που περνούν από τον **ίδιο** διάλογο προεπισκόπησης (η επαναφορά έχει δικό της). */
export type MemberExitMode = 'removal' | 'pause';

/** Τα **κοινά** κείμενα του διαλόγου προεπισκόπησης — ίδια για αφαίρεση και παύση. */
export const MEMBER_EXIT_KEYS = {
  loadingPreview: 'admin-member-exit:removeMember.loadingPreview',
  /** ⚠️ Χωρίς προεπισκόπηση **δεν** δίνουμε το κουμπί — ποτέ πράξη στα τυφλά (§3.6). */
  previewFailed: 'admin-member-exit:removeMember.previewFailed',
  retry: 'admin-member-exit:removeMember.retry',
  consequencesHeading: 'admin-member-exit:removeMember.consequencesHeading',
  heir: 'admin-member-exit:removeMember.heir',
  noHeir: 'admin-member-exit:removeMember.noHeir',
  actTeams: 'admin-member-exit:removeMember.actTeams',
  signsOut: 'admin-member-exit:removeMember.signsOut',
  staysSignedIn: 'admin-member-exit:removeMember.staysSignedIn',
  reasonLabel: 'admin-member-exit:removeMember.reasonLabel',
  reasonPlaceholder: 'admin-member-exit:removeMember.reasonPlaceholder',
} as const;

/** Τα κείμενα που **διαφέρουν** ανά δρόμο. */
interface ModeKeys {
  readonly button: string;
  readonly title: string;
  readonly description: string;
  readonly notified: string;
  readonly confirm: string;
  readonly success: string;
  /** 503: η επανάληψη είναι **ασφαλής** — ο ενορχηστρωτής επισκευάζει ιδεμποτικά. */
  readonly error: string;
}

export const MEMBER_EXIT_MODE_KEYS: Readonly<Record<MemberExitMode, ModeKeys>> = {
  removal: {
    button: 'admin-member-exit:removeMember.button',
    title: 'admin-member-exit:removeMember.title',
    description: 'admin-member-exit:removeMember.description',
    notified: 'admin-member-exit:removeMember.notified',
    confirm: 'admin-member-exit:removeMember.confirm',
    success: 'admin-member-exit:removeMember.success',
    error: 'admin-member-exit:removeMember.error',
  },
  pause: {
    button: 'admin-member-exit:pauseAccess.button',
    title: 'admin-member-exit:pauseAccess.title',
    description: 'admin-member-exit:pauseAccess.description',
    notified: 'admin-member-exit:pauseAccess.notified',
    confirm: 'admin-member-exit:pauseAccess.confirm',
    success: 'admin-member-exit:pauseAccess.success',
    error: 'admin-member-exit:pauseAccess.error',
  },
};

/** Μόνο της παύσης: μένει μέλος · ομάδες που **μένουν** χωρίς διαθέσιμο υπεύθυνο · προαιρετική μεταβίβαση. */
export const MEMBER_PAUSE_KEYS = {
  staysMember: 'admin-member-exit:pauseAccess.staysMember',
  actTeamsKept: 'admin-member-exit:pauseAccess.actTeamsKept',
  transferLabel: 'admin-member-exit:pauseAccess.transferLabel',
} as const;

/** Η επαναφορά — δικός της (απλός) διάλογος. */
export const MEMBER_RESTORE_KEYS = {
  button: 'admin-member-exit:restoreAccess.button',
  title: 'admin-member-exit:restoreAccess.title',
  description: 'admin-member-exit:restoreAccess.description',
  pausedBy: 'admin-member-exit:restoreAccess.pausedBy',
  pausedReason: 'admin-member-exit:restoreAccess.pausedReason',
  notified: 'admin-member-exit:restoreAccess.notified',
  confirm: 'admin-member-exit:restoreAccess.confirm',
  success: 'admin-member-exit:restoreAccess.success',
  error: 'admin-member-exit:restoreAccess.error',
} as const;

/** Γιατί **δεν** επιτρέπεται → λέξη. camelCase κλειδιά, όπως στο `invite-labels.ts`. */
export const MEMBER_EXIT_REFUSAL_KEY: Readonly<Record<MemberExitRefusal, string>> = {
  'not-a-member': 'admin-member-exit:removeMember.refused.notAMember',
  'self-removal': 'admin-member-exit:removeMember.refused.selfRemoval',
  'self-pause': 'admin-member-exit:removeMember.refused.selfPause',
  'self-restore': 'admin-member-exit:removeMember.refused.selfRestore',
  'not-self-departure': 'admin-member-exit:removeMember.refused.notSelfDeparture',
  'outranks-actor': 'admin-member-exit:removeMember.refused.outranksActor',
  'last-manager': 'admin-member-exit:removeMember.refused.lastManager',
};

/** Το κλειστό σύνολο, για ανάγνωση του `reason` της 409 (`refusalOf`) — παράγεται, δεν ξαναγράφεται. */
export const MEMBER_EXIT_REFUSALS = Object.keys(MEMBER_EXIT_REFUSAL_KEY) as readonly MemberExitRefusal[];
