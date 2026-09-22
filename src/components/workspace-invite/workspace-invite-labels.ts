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
import { HOME_REDIRECT_ROUTE } from '@/lib/workspace/workspace-routes';
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
  /**
   * 🔑 **ΜΙΑ λέξη αναμονής ΑΝΑ ΠΡΑΞΗ, στο κουμπί που ΠΑΤΗΘΗΚΕ** (ADR-853 §13 ε.β). Ήταν ένα
   * κοινό «Γίνεται αποθήκευση…» ζωγραφισμένο **πάντα** στην αποδοχή: όποιος απέρριπτε έβλεπε
   * ότι «αποθηκεύεται» η **αποδοχή** (Material/Slack: η ένδειξη ζει στο πατημένο κουμπί).
   */
  accepting: 'auth:workspaceInvite.accepting',
  declining: 'auth:workspaceInvite.declining',
  /** §13 ε.δ — «συνδεδεμένοι ως Χ», **πριν** το κλικ· και ο δρόμος: αλλαγή με επιστροφή. */
  otherAccount: 'auth:workspaceInvite.otherAccount',
  switchAccount: 'auth:workspaceInvite.switchAccount',
  switchingAccount: 'auth:workspaceInvite.switchingAccount',

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
  'link-foreign': 'auth:workspaceInvite.refusal.link-foreign',
  'invitation-unknown': 'auth:workspaceInvite.refusal.invitation-unknown',
  expired: 'auth:workspaceInvite.refusal.expired',
  'already-used': 'auth:workspaceInvite.refusal.already-used',
  revoked: 'auth:workspaceInvite.refusal.revoked',
  'wrong-recipient': 'auth:workspaceInvite.refusal.wrong-recipient',
  'already-member': 'auth:workspaceInvite.refusal.already-member',
  'role-above-inviter': 'auth:workspaceInvite.refusal.role-above-inviter',
};

/**
 * **Ο ρόλος → λέξη** — ο **ΕΝΑΣ** κατάλογος, ADR-853 §17 (Ε-Β).
 *
 * 🔴 **ΗΤΑΝ ΤΡΙΑ ΟΝΟΜΑΤΑ ΓΙΑ ΤΟΝ ΙΔΙΟ ΡΟΛΟ** (μετρημένο 2026-09-22): «Εσωτερικός» στη
 * διαχείριση, «Εσωτερικός συνεργάτης» εδώ, «Εσωτερικός χρήστης» στο email — ο ίδιος
 * άνθρωπος, τρεις λέξεις, στην ίδια ροή. Πλέον **ένα** κλειδί ανά ρόλο.
 *
 * 🔑 **ΓΙΑΤΙ `common` ΚΑΙ ΟΧΙ `admin`**: το παλιό αντίγραφο υπήρχε επειδή το namespace
 * `admin` **δεν φορτώνεται ποτέ** σε αυτή τη δημόσια σελίδα (ο άνθρωπος φτάνει από email,
 * χωρίς ταυτότητα) — ο λόγος ήταν σωστός, η θεραπεία λάθος: το σωστό ήταν να **μετακομίσει
 * το λεξιλόγιο** εκεί που το φτάνουν **όλοι**, όχι να αντιγραφεί.
 */
export const INVITED_ROLE_KEY: Readonly<Record<InvitableRole, string>> = {
  company_admin: 'common:globalRoles.company_admin',
  internal_user: 'common:globalRoles.internal_user',
  external_user: 'common:globalRoles.external_user',
};

/** **Η διέξοδος → λέξη κουμπιού.** Τρίτη διέξοδος δεν μεταγλωττίζεται χωρίς λέξη. */
export const EXIT_KEY: Readonly<Record<WorkspaceInviteExitName, string>> = {
  'sign-in': 'auth:workspaceInvite.exit.sign-in',
  home: 'auth:workspaceInvite.exit.home',
  workspace: 'auth:workspaceInvite.exit.workspace',
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
  // 🔑 **`/home`, ΟΧΙ `/o/<ψευδώνυμο>`** (ADR-819 §8): η οθόνη **δεν ξέρει** ψευδώνυμο — έχει
  //    μόνο `companyId` — και μια κατασκευασμένη διεύθυνση θα ήταν μαντεψιά. Το `/home`
  //    ρωτά τον διακομιστή «πού ανήκει αυτός;» τη στιγμή του κλικ, με **307**.
  workspace: HOME_REDIRECT_ROUTE,
} as const satisfies Record<WorkspaceInviteExitName, string>;

/**
 * **Κάθε άρνηση ξέρει πού στέλνει τον άνθρωπο** — και ο τύπος απαιτεί **και οι εννέα** να
 * απαντηθούν. Ένα `switch` με `default` θα κατάπινε τη δέκατη σιωπηλά.
 *
 * 🔑 Ο διαχωρισμός δεν είναι αισθητικός: `sign-in` σημαίνει *«υπάρχει πράξη, λείπει η σωστή
 * ταυτότητα»*· `home` σημαίνει *«δεν υπάρχει τίποτα να κάνεις εδώ»*. Να δώσουμε «Σύνδεση»
 * σε ληγμένη πρόσκληση θα ήταν κουμπί που **δεν οδηγεί πουθενά** — αδιέξοδο **με** κουμπί,
 * χειρότερο από αδιέξοδο χωρίς (ADR-844 Α3).
 *
 * 🔴 **ΕΝΑΣ πίνακας για ΔΥΟ στιγμές** — την **όψη** (`page.tsx`) **και** την **πράξη**
 * (`WorkspaceInviteContent`). Μέχρι 2026-09-21 ζούσε ιδιωτικός στο `page.tsx`, και η άρνηση
 * την ώρα της πράξης ζωγραφιζόταν **με τον τίτλο του παροδικού** («δεν μπορούμε αυτή τη
 * στιγμή») και **πάντα** «αρχική»: ο τίτλος υποσχόταν *«περιμένετε»* ενώ το σώμα έλεγε
 * *«κάντε κάτι»* — δύο αντίθετες οδηγίες στην ίδια κάρτα (ADR-853 §13).
 */
/**
 * **Αυτή η άρνηση σημαίνει «δεν υπάρχει τίποτα εδώ», ή «υπάρχει, και να η κατάστασή του»;**
 * — ADR-853 §18 (Ε-Η).
 *
 * 🔴 **Το εύρημα**: η σελίδα απαντούσε **HTTP 200** σε **κάθε** άρνηση, ακόμη και σε σύνδεσμο
 * που δεν δείχνει πουθενά — ενώ το API της όψης απαντά σωστά 400/421
 * (`preview/[token]/route.ts`). Δύο πόρτες για το ίδιο ερώτημα, δύο απαντήσεις.
 *
 * 🔑 **Η γραμμή δεν είναι «σφάλμα ή όχι» — είναι ΤΙ ΡΩΤΗΣΕ Ο ΠΕΛΑΤΗΣ**:
 *   · `true`  ⇒ ο σύνδεσμος **δεν αντιστοιχεί σε πρόσκληση αυτού του κόσμου** (χαλασμένη
 *     υπογραφή · άλλο περιβάλλον · έγγραφο που δεν υπάρχει) ⇒ **404**, με `notFound()`.
 *   · `false` ⇒ η πρόσκληση **υπάρχει** και το σώμα είναι η **αναπαράστασή της** («έληξε»,
 *     «ανακλήθηκε», «απαντήθηκε ήδη», «άλλος παραλήπτης») ⇒ **200**, που είναι και η
 *     συμπεριφορά Slack/Figma/GitHub για ληγμένο σύνδεσμο: η κατάσταση **είναι** η απάντηση.
 *
 * ⚠️ **Γιατί όχι 410/422 για τις δεύτερες**: στο App Router ένα server component μπορεί να
 * εκφράσει **404** (`notFound()`) και — πειραματικά, πίσω από `authInterrupts` — 401/403.
 * Αυθαίρετο status θέλει route handler ή middleware, δηλαδή **δεύτερη** επικύρωση του token
 * σε άλλο στρώμα. Το τίμημα (δύο κριτές για την ίδια πρόσκληση) είναι μεγαλύτερο από το
 * κέρδος (ακριβέστερος κωδικός σε σελίδα που είναι ήδη `noindex`).
 *
 * ⚠️ **`Record` πάνω στο κλειστό σύνολο**: μια **δέκατη** άρνηση δεν μεταγλωττίζεται μέχρι
 * κάποιος να πει τι απαντά το δίκτυο γι' αυτήν.
 */
export const REFUSAL_IS_NOT_FOUND: Readonly<Record<WorkspaceInvitationRefusal, boolean>> = {
  /** Η υπογραφή δεν στέκει — δεν υπάρχει πρόσκληση πίσω από αυτόν τον σύνδεσμο. */
  'link-invalid': true,
  /** Υπογεγραμμένος για **άλλο** περιβάλλον: σε **αυτόν** τον host δεν υπάρχει. */
  'link-foreign': true,
  /** Έγκυρος σύνδεσμος, **κανένα έγγραφο** — η κλασική περίπτωση 404. */
  'invitation-unknown': true,
  /** Οι επόμενες **υπάρχουν όλες**: το σώμα λέει την κατάστασή τους. */
  expired: false,
  'already-used': false,
  revoked: false,
  'wrong-recipient': false,
  'already-member': false,
  'role-above-inviter': false,
};

export const EXIT_BY_REFUSAL: Readonly<Record<WorkspaceInvitationRefusal, WorkspaceInviteExitName>> = {
  'link-invalid': 'home',
  'link-foreign': 'home',
  'invitation-unknown': 'home',
  expired: 'home',
  /** Απάντησε ήδη — **επιτυχία στο παρελθόν**. Ο δρόμος του είναι μέσα. */
  'already-used': 'sign-in',
  revoked: 'home',
  /** Είναι **λάθος λογαριασμός**, όχι λάθος σύνδεσμος: ξανασυνδέσου ως ο παραλήπτης. */
  'wrong-recipient': 'sign-in',
  'already-member': 'sign-in',
  'role-above-inviter': 'home',
};
