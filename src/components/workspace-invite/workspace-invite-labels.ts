/**
 * @fileoverview **ΤΑ ΚΛΕΙΔΙΑ ΤΗΣ ΣΕΛΙΔΑΣ ΠΡΟΣΚΛΗΣΗΣ** — πλήρη κυριολεκτικά, σε κλειστούς πίνακες.
 * @related types/workspace-invitation-view.ts · app/(auth)/invite/[token]/page.tsx · ADR-744
 * @module components/workspace-invite/workspace-invite-labels
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΠΛΗΡΗ ΚΥΡΙΟΛΕΚΤΙΚΑ ΚΑΙ ΟΧΙ `` `${K}.title` `` — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΑΙΣΘΗΤΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 * Η πρώτη γραφή αυτού του αρχείου έχτιζε κάθε κλειδί ως `` `${K}.title` `` με
 * `` const K = `${WORKSPACE_INVITE_NS}:workspaceInvite` `` — **εισηγμένη** σταθερά.
 * Ο γεννήτορας του shell slice απάντησε:
 *
 *     ❔ /invite/[token]    2   ΔΕΝ ΚΡΙΘΗΚΕ bytes ·  0.0% κελ. ·  **0 ns []**
 *
 * **Μηδέν κλειδιά, μηδέν namespaces.** Η αιτία διαβάστηκε στην πηγή
 * (`scripts/lib/i18n-shell-slice/`): το `collectScopeDeclarations` διαβάζει **μόνο** τα
 * `const` του **ίδιου αρχείου** και **δεν ακολουθεί εισαγωγές**· άρα το `K` δεν λύνεται,
 * και το `foldObjectLiteral` κρατά την τιμή **μόνο αν το πρότυπο ΟΛΟΚΛΗΡΩΝΕΙ**
 * (*«μισή τιμή δεν καταγράφεται»*). Επιπλέον το `splitKey` παράγει το namespace **από το
 * πρόθεμα `ns:` του ίδιου του κλειδιού** — οπότε μηδέν αναγνώσιμα κλειδιά σημαίνει
 * αυτομάτως και μηδέν namespaces. **Μία ρίζα, δύο συμπτώματα.**
 *
 * ⇒ Ίδιο ιδίωμα με το ζωντανό `components/contact/first-contact-labels.ts`, που γράφει
 *   `'property-market:contact.first.target-absent'` **ολογράφως**.
 *
 * ⛔ **ΜΗΝ «συμμαζέψεις» τα προθέματα σε σταθερά.** Το `${K}` μοιάζει καθαρότερο και είναι
 *    **σιωπηλά σπασμένο**: δεν πετά, δεν προειδοποιεί — απλώς η σελίδα μένει χωρίς slice
 *    και βάφει ωμά κλειδιά σε άνθρωπο που μόλις ήρθε από email.
 * ⛔ **ΠΟΤΕ `spread`** — ο εξαγωγέας διαβάζει **τιμές σταθεράς module**· ένα `{...A}`
 *    βγαίνει *«unresolved dynamic t()»* και ο γεννήτορας **αρνείται** να παράξει.
 *
 * 🔑 **`Record` ΠΑΝΩ ΣΤΑ ΚΛΕΙΣΤΑ ΣΥΝΟΛΑ**: μια **δέκατη** άρνηση ή μια **τρίτη** διέξοδος
 * **δεν μεταγλωττίζονται** μέχρι κάποιος να πει τι διαβάζει ο άνθρωπος. Ελεύθερος πίνακας
 * θα σιωπούσε — και η σιωπή εδώ είναι λευκή σελίδα.
 */

import type { InvitableRole, WorkspaceInvitationRefusal } from '@/types/workspace-invitation';
import type { WorkspaceInviteExitName } from '@/types/workspace-invitation-view';

/**
 * Τα σταθερά κλειδιά της οθόνης. Εξάγεται ώστε να τα εισάγουν **και οι άγκυρες**: σουίτα
 * που ξαναγράφει τις συμβολοσειρές στο χέρι μένει **πράσινη** όταν η οθόνη αλλάξει κλειδί.
 */
export const INVITE_PAGE_KEYS = {
  title: 'auth:workspaceInvite.title',
  intro: 'auth:workspaceInvite.intro',
  roleLine: 'auth:workspaceInvite.roleLine',
  expiresLine: 'auth:workspaceInvite.expiresLine',
  /** §5 #4 · ADR-798 — *«δηλωμένη, ΟΧΙ επαληθευμένη»*, γραμμένο στην οθόνη. */
  identityDeclared: 'auth:workspaceInvite.identityDeclared',

  signInToAccept: 'auth:workspaceInvite.signInToAccept',
  /** Δ1 της Φ5, τώρα και στην οθόνη: ο σύνδεσμος δουλεύει **μόνο** γι' αυτή τη διεύθυνση. */
  signInHint: 'auth:workspaceInvite.signInHint',

  accept: 'auth:workspaceInvite.accept',
  decline: 'auth:workspaceInvite.decline',
  working: 'auth:workspaceInvite.working',

  acceptedTitle: 'auth:workspaceInvite.accepted.title',
  acceptedActiveNow: 'auth:workspaceInvite.accepted.activeNow',
  /**
   * 🔴 **ΤΟ ΔΗΛΩΜΕΝΟ ΟΡΙΟ §6 #1, ΕΙΠΩΜΕΝΟ ΜΕ ΟΝΟΜΑ.** Το `activeWorkspaceChanged: false`
   * σημαίνει *«είσαι μέλος, αλλά ο χώρος **δεν** είναι ο ενεργός σου»*. Σιωπή εδώ θα άφηνε
   * τον άνθρωπο να συνδεθεί και να **μη βρει** τον χώρο που μόλις δέχτηκε.
   */
  acceptedNotActive: 'auth:workspaceInvite.accepted.notActive',

  declinedTitle: 'auth:workspaceInvite.declined.title',
  declinedBody: 'auth:workspaceInvite.declined.body',

  unavailableTitle: 'auth:workspaceInvite.unavailable.title',
  unavailableBody: 'auth:workspaceInvite.unavailable.body',
  /**
   * 🔑 **Το «δοκιμάστε ξανά» ΠΡΟΣΦΕΡΕΤΑΙ, δεν περιγράφεται** (ADR-844 Α3). Το `unavailable`
   * είναι **παροδικό** από ορισμό *(«δεν μπορέσαμε να ρωτήσουμε»)* — μόνη διέξοδος «αρχική»
   * σήμαινε: ξαναβρές το email, ξαναπάτα τον σύνδεσμο.
   */
  retry: 'auth:workspaceInvite.unavailable.retry',
  retrying: 'auth:workspaceInvite.unavailable.retrying',
} as const;

/**
 * **Ο λόγος άρνησης → λέξη**, και **και οι εννέα** απαντώνται.
 *
 * ⚠️ Τέσσερις είναι **άφταστοι** από τη δημόσια όψη *(θέλουν συνδεδεμένο άνθρωπο)* — αλλά
 * φτάνουν από την **εξαργύρωση**, στην ίδια οθόνη. Ο πίνακας είναι **πλήρης κάλυψη
 * λεξιλογίου**, όχι λίστα του τι συμβαίνει σήμερα: ίδιο ιδίωμα με το `STATUS_BY_REFUSAL`.
 */
export const REFUSAL_KEY: Readonly<Record<WorkspaceInvitationRefusal, string>> = {
  'link-invalid': 'auth:workspaceInvite.refusal.link-invalid',
  'invitation-unknown': 'auth:workspaceInvite.refusal.invitation-unknown',
  expired: 'auth:workspaceInvite.refusal.expired',
  'already-used': 'auth:workspaceInvite.refusal.already-used',
  revoked: 'auth:workspaceInvite.refusal.revoked',
  'wrong-recipient': 'auth:workspaceInvite.refusal.wrong-recipient',
  'email-unverified': 'auth:workspaceInvite.refusal.email-unverified',
  'already-member': 'auth:workspaceInvite.refusal.already-member',
  'role-above-inviter': 'auth:workspaceInvite.refusal.role-above-inviter',
};

/**
 * **Ο ρόλος → λέξη**, στη **δική μας** βάση.
 *
 * 🔴 **ΓΙΑΤΙ ΔΕΝ ΞΑΝΑΧΡΗΣΙΜΟΠΟΙΟΥΝΤΑΙ ΤΑ `roleManagement.roleNames.*`**: ζουν στο
 * namespace **`admin`**, που **δεν φορτώνεται ποτέ** σε αυτή τη δημόσια σελίδα — ο
 * άνθρωπος φτάνει από email, χωρίς ταυτότητα. Χωρίς αυτόν τον πίνακα η οθόνη θα έβαφε
 * **ωμό `internal_user`**.
 */
export const INVITED_ROLE_KEY: Readonly<Record<InvitableRole, string>> = {
  company_admin: 'auth:workspaceInvite.role.company_admin',
  internal_user: 'auth:workspaceInvite.role.internal_user',
  external_user: 'auth:workspaceInvite.role.external_user',
};

/** **Η διέξοδος → λέξη κουμπιού.** Τρίτη διέξοδος δεν μεταγλωττίζεται χωρίς λέξη. */
export const EXIT_KEY: Readonly<Record<WorkspaceInviteExitName, string>> = {
  'sign-in': 'auth:workspaceInvite.exit.sign-in',
  home: 'auth:workspaceInvite.exit.home',
};

/**
 * **Η διέξοδος → διεύθυνση**, σε **κυριολεκτικό** πίνακα.
 *
 * 🔑 Γι' αυτό ο τύπος συνόρου κουβαλά **όνομα** και όχι `href`: η δρομολόγηση ζει εδώ και
 * περνά από το **σύνορο πλοήγησης** (CHECK 3.61) — ποτέ μέσα σε αρχείο τύπων.
 *
 * ⚠️ **`as const` ΚΑΙ ΟΧΙ `Record<…, string>`**: ο `Link` του συνόρου είναι **γενικός** πάνω
 * σε `WorkspaceHref<T>` και δέχεται **κυριολεκτικές** διευθύνσεις — ευρεία `string` δεν
 * είναι εκχωρήσιμη εκεί.
 */
export const EXIT_HREF = {
  'sign-in': '/login',
  home: '/',
} as const satisfies Record<WorkspaceInviteExitName, string>;
