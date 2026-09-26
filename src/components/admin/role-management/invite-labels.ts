/**
 * ADR-853 Φ6 — **ΤΑ ΚΛΕΙΔΙΑ ΤΗΣ ΟΘΟΝΗΣ ΠΡΟΣΚΛΗΣΗΣ**, κυριολεκτικά και σε κλειστούς πίνακες.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΚΥΡΙΟΛΕΚΤΙΚΕΣ ΣΥΜΒΟΛΟΣΕΙΡΕΣ ΚΑΙ ΟΧΙ `t(\`…${kind}\`)`
 * ─────────────────────────────────────────────────────────────────────────────
 * Το **CHECK 3.8** (ADR-777) διαβάζει **τιμές σταθερών module** για να απαντήσει *«υπάρχει
 * αυτό το κλειδί στα locales;»*. Ένα κλειδί συναρμολογημένο σε πρότυπη συμβολοσειρά είναι
 * **αόρατο** στην πύλη — δηλαδή ένα ορφανό κλειδί φτάνει ζωντανό στην οθόνη ως ωμό κείμενο.
 * Εδώ κάθε κλειδί είναι γραμμένο **ολόκληρο**, μία φορά.
 *
 * ⛔ **ΠΟΤΕ `spread` ΜΕΣΑ ΣΕ ΑΥΤΟΥΣ ΤΟΥΣ ΠΙΝΑΚΕΣ** — ο εξαγωγέας βλέπει τότε «πίνακας
 *    φτιαγμένος από άλλον πίνακα» και χάνει τις τιμές.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ `Record` ΠΑΝΩ ΣΤΑ ΚΛΕΙΣΤΑ ΣΥΝΟΛΑ ΚΑΙ ΟΧΙ ΧΕΙΡΟΓΡΑΦΟΣ ΠΙΝΑΚΑΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ένας ελεύθερος πίνακας θα απαντούσε *«αυτές οι τέσσερις καταστάσεις έχουν λέξη»* και θα
 * **σιωπούσε για την πέμπτη**. Με `Record` πάνω στο κλειστό σύνολο, μια **έκτη** κατάσταση
 * ή μια **τέταρτη** έκβαση παράδοσης **δεν μεταγλωττίζεται** μέχρι κάποιος να πει τι
 * σημαίνει για τον άνθρωπο. Ίδιο ιδίωμα με το `STATUS_BY_REFUSAL` της διαδρομής όψης και
 * με τα `SETBACKS` της σουίτας `first-contact-dead-end`.
 *
 * ⚠️ **ΤΑ ΚΛΕΙΔΙΑ ΕΙΝΑΙ camelCase ΑΚΟΜΗ ΚΑΙ ΟΤΑΝ ΤΟ ΟΝΟΜΑ ΤΗΣ ΕΚΒΑΣΗΣ ΕΧΕΙ ΠΑΥΛΕΣ**
 * (`role-above-inviter` → `roleAboveInviter`): ο διαχωριστής του i18next είναι η τελεία και
 * μια παύλα μέσα σε τμήμα **δεν** έχει δοκιμαστεί σε αυτό το δέντρο. Ο πίνακας κάνει τη
 * μετάφραση **δωρεάν** — δεν υπάρχει λόγος να στοιχηματίσουμε στη ρύθμιση.
 *
 * @module components/admin/role-management/invite-labels
 * @see docs/centralized-systems/reference/adrs/ADR-853-workspace-invitations.md §8 Φ6
 */

// ⚠️ **TYPE-ONLY ΠΕΡΑ ΑΠΟ ΤΟ ΣΥΝΟΡΟ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ, ΚΑΙ ΕΙΝΑΙ ΖΩΝΤΑΝΟ ΙΔΙΩΜΑ ΕΔΩ.**
//    Το `server/invitations/invitation-notice.ts` ξεκινά με `import 'server-only'`, αλλά ένα
//    `import type` **σβήνεται στη μεταγλώττιση** — δεν φτάνει τίποτα στο bundle του
//    φυλλομετρητή. Τρεις πελατειακές επιφάνειες το κάνουν ήδη από το
//    `@/server/admin/admin-guards` (`OperatorInboxClient` · `AIInboxClient` ·
//    `useAIInboxState`). 🔑 Η εναλλακτική — **αντιγραφή** των τριών εκβάσεων εδώ — θα ήταν
//    **δεύτερο λεξιλόγιο** ελεύθερο να αποκλίνει την πρώτη φορά που ο πάροχος αποκτήσει
//    τέταρτη έκβαση (N.0.2 · ADR-749).
import type { InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
// ⚠️ Ο αναγνώστης ζει στο `services/workspace/`, **δίπλα στον καλούντα του** — το ίδιο
//    ζευγάρι που έχει ήδη το `services/contact/` (`first-contact.client.ts` +
//    `first-contact-failure-readers.ts`). Εδώ μένουν **μόνο οι λέξεις**.
import type {
  IssueSetback,
  RevokeSetback,
} from '@/services/workspace/workspace-invitation-failure-readers';
import type { WorkspaceInvitationState } from '@/types/workspace-invitation';

// =============================================================================
// 1. ΟΙ ΛΕΞΕΙΣ ΤΗΣ ΕΠΙΦΑΝΕΙΑΣ
// =============================================================================

/**
 * Τα σταθερά κλειδιά του κουμπιού, του διαλόγου και του πίνακα.
 *
 * 🔑 **Εξάγεται ώστε να το εισάγουν ΚΑΙ οι άγκυρες**: μια σουίτα που γράφει τις
 * συμβολοσειρές ξανά στο χέρι μένει **πράσινη** όταν η οθόνη αλλάξει κλειδί — δηλαδή
 * σταματά να φυλά αυτό που νομίζει ότι φυλά. Πρότυπο: `ACT_KEYS` / `GUEST_KEYS` της
 * `first-contact-dead-end.test.tsx`.
 */
export const INVITE_KEYS = {
  /** Το κουμπί στο `<header>` της κονσόλας. */
  button: 'roleManagement.invite.button',

  // ── Ο διάλογος ────────────────────────────────────────────────────────────
  title: 'roleManagement.invite.title',
  description: 'roleManagement.invite.description',
  emailLabel: 'roleManagement.invite.emailLabel',
  emailPlaceholder: 'roleManagement.invite.emailPlaceholder',
  roleLabel: 'roleManagement.invite.roleLabel',
  submit: 'roleManagement.invite.submit',
  /** Γενική αποτυχία — **μόνο** όταν κανένας ονομασμένος λόγος δεν ταίριαξε. */
  error: 'roleManagement.invite.error',

  // ── Η επιτυχία, με ΤΡΙΑ πράγματα να πει ───────────────────────────────────
  success: 'roleManagement.invite.success',
  /**
   * 🔑 **Η ΕΠΑΝΑΠΟΣΤΟΛΗ ΕΙΝΑΙ ΤΟ ΙΔΙΟ POST ΞΑΝΑ** (§7.3): η προηγούμενη ζωντανή γίνεται
   * `revoked` στην **ίδια** συναλλαγή. Ο διαχειριστής **πρέπει** να το μάθει, αλλιώς
   * νομίζει ότι κυκλοφορούν δύο σύνδεσμοι ενώ ο παλιός είναι ήδη νεκρός.
   */
  superseded: 'roleManagement.invite.superseded',

  // ── Ο πίνακας ─────────────────────────────────────────────────────────────
  listHeading: 'roleManagement.invite.list.heading',
  listEmpty: 'roleManagement.invite.list.empty',
  listEmail: 'roleManagement.invite.list.email',
  listRole: 'roleManagement.invite.list.role',
  listState: 'roleManagement.invite.list.state',
  listExpires: 'roleManagement.invite.list.expires',
  listOpened: 'roleManagement.invite.list.opened',
  listActions: 'roleManagement.invite.list.actions',
  /**
   * ⚠️ **«Ένδειξη, όχι απόδειξη»** (§6 #3): οι πελάτες email **προ-φορτώνουν** συνδέσμους,
   * άρα ένα `openedAt` μπορεί να γράφτηκε από σαρωτή και ποτέ από άνθρωπο. Η στήλη το λέει
   * με **λέξεις** — ποτέ «το είδε».
   */
  openedHint: 'roleManagement.invite.list.openedHint',
  openedNever: 'roleManagement.invite.list.openedNever',

  // ── Οι πράξεις της γραμμής ────────────────────────────────────────────────
  actionRevoke: 'roleManagement.invite.actions.revoke',
  actionResend: 'roleManagement.invite.actions.resend',
  revokeSuccess: 'roleManagement.invite.actions.revokeSuccess',
} as const;

// =============================================================================
// 2. ΟΙ ΚΛΕΙΣΤΟΙ ΠΙΝΑΚΕΣ — μια νέα τιμή ΔΕΝ ΜΕΤΑΓΛΩΤΤΙΖΕΤΑΙ χωρίς λέξη
// =============================================================================

/**
 * Η κατάσταση της πρόσκλησης → λέξη.
 *
 * ⚠️ **Και οι πέντε, παρότι η λίστα του διακομιστή γυρίζει μόνο ζωντανές**: το `expired`
 * ταξιδεύει **παραγόμενο** (άγκυρα Λ2 — κανείς δεν σκουπίζει τις ληγμένες), και το
 * `revoked`/`accepted` το βλέπει η οθόνη στη **σύγκρουση 409** πριν προλάβει να ξαναφέρει
 * τη λίστα.
 */
export const INVITATION_STATE_KEY: Readonly<Record<WorkspaceInvitationState, string>> = {
  pending: 'roleManagement.invite.state.pending',
  accepted: 'roleManagement.invite.state.accepted',
  declined: 'roleManagement.invite.state.declined',
  revoked: 'roleManagement.invite.state.revoked',
  expired: 'roleManagement.invite.state.expired',
};

/**
 * Η έκβαση της **παράδοσης** → λέξη.
 *
 * 🔴 **ΚΑΜΙΑ ΑΠΟ ΤΙΣ ΤΡΕΙΣ ΔΕΝ ΛΕΕΙ «ΣΤΑΛΘΗΚΕ», ΚΑΙ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΙΚΟ ΣΗΜΕΙΟ.** Το
 * `accepted` σημαίνει *«ο πάροχος το δέχτηκε προς αποστολή»* — το ίδιο το λεξιλόγιο του
 * Mailgun ξεχωρίζει `accepted` από `delivered`, με `temporary_fail`/`permanent_fail`
 * ανάμεσα. Μια λέξη «στάλθηκε» εδώ θα ήταν **ψέμα με παράλειψη**, το ίδιο σχήμα που το
 * έργο απαγορεύει ήδη στο `openedAt` *(«ένδειξη, όχι απόδειξη»)* και στο
 * `identityAssurance` *(«τρεις καταστάσεις, ποτέ boolean»)*.
 */
export const DELIVERY_KEY: Readonly<Record<InvitationNoticeOutcome, string>> = {
  accepted: 'roleManagement.invite.delivery.accepted',
  unaddressable: 'roleManagement.invite.delivery.unaddressable',
  failed: 'roleManagement.invite.delivery.failed',
};

/** Γιατί δεν **εκδόθηκε** → λέξη. Κάθε μία στέλνει σε άλλη ενέργεια (δες τον αναγνώστη). */
export const ISSUE_SETBACK_KEY: Readonly<Record<IssueSetback['kind'], string>> = {
  'role-above-inviter': 'roleManagement.invite.issueSetback.roleAboveInviter',
  'role-not-invitable': 'roleManagement.invite.issueSetback.roleNotInvitable',
  unavailable: 'roleManagement.invite.issueSetback.unavailable',
};

/** Γιατί δεν **ανακλήθηκε** → λέξη. */
export const REVOKE_SETBACK_KEY: Readonly<Record<RevokeSetback['kind'], string>> = {
  'already-resolved': 'roleManagement.invite.revokeSetback.alreadyResolved',
  'not-found': 'roleManagement.invite.revokeSetback.notFound',
  unavailable: 'roleManagement.invite.revokeSetback.unavailable',
};
