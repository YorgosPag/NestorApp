/**
 * @fileoverview **ΚΩΔΙΚΟΣ → ΚΛΕΙΔΙ ΚΕΙΜΕΝΟΥ** για τον κατάλογο εντολών.
 * @related ADR-777 §8.34 · lib/mandate/mandate-standing.ts · N.11 · CHECK 3.8
 * @module components/mandate/catalog/mandate-catalog-labels
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ `t(\`…standing.${row.standing}\`)`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το δυναμικό κλειδί θα ήταν μία γραμμή αντί για δέκα. Θα ήταν επίσης:
 *
 * 1. **Αόρατο στη CHECK 3.8** — η πύλη που ρωτά «υπάρχει αυτό το κλειδί;» διαβάζει
 *    **κυριολεκτικά** ορίσματα του `t()`. Ένα κλειδί που λείπει θα προσγειωνόταν
 *    πράσινο και θα έβγαινε **ωμό στην οθόνη**. Είναι ακριβώς το μάθημα **Μ-Η** του
 *    §8.33: *«κανένα μήνυμα “τι λείπει” δεν ελεγχόταν ποτέ, γιατί χτίζεται δυναμικά»*.
 * 2. **Καύσιμο για το ανοιχτό πρόβλημα του §8.33** — οι **76 ανεπίλυτες δυναμικές
 *    `t()`** είναι ο λόγος που ο generator του route slice **αρνήθηκε** να παράγει.
 *    Κάθε νέα δυναμική κλήση κάνει εκείνη τη δουλειά **δυσκολότερη**.
 *
 * 🔑 **Ο πίνακας ΔΕΝ είναι δεύτερη αυθεντία**, και αυτό είναι το κρίσιμο: ο τύπος του
 * είναι `Record<MandateStanding, string>` ⇒ **ενδέκατη κατάσταση δεν μεταγλωττίζεται**
 * μέχρι κάποιος να της δώσει κείμενο. Ένα δυναμικό κλειδί, αντίθετα, θα «δούλευε» και
 * θα ζωγράφιζε `offer.mandates.standing.νεα-κατασταση` σε παραγωγή.
 *
 * ⚠️ **Η άγκυρα `mandate-catalog-labels.test.ts` επιβάλλει το άλλο μισό**: ότι κάθε
 * κλειδί εδώ **υπάρχει** στα `el` ΚΑΙ στα `en`. Ο μεταγλωττιστής φυλά την πληρότητα
 * του πίνακα· μόνο ένα test φυλά την ύπαρξη του κειμένου.
 */

import type {
  MandateStanding,
  MandateStandingGroup,
} from '@/lib/mandate/mandate-standing';
import type { MandateActionRejection } from '@/lib/mandate/mandate-actions';
import {
  CLIENT_NAME_KNOWN,
  type MandateClientName,
} from '@/lib/mandate/mandate-client-name';
import type { MandateNotifyOutcome, MandateProofVia } from '@/types/owner-property-mandate';
import type { PresenceAction } from '@/lib/owner-property/listing-presence';

/**
 * Το namespace του καταλόγου — **`property-market`** από το ADR-777 §8.38.
 *
 * 🔴 ΣΤΗ ΜΕΤΑΚΟΜΙΣΗ ΑΥΤΗ Η ΣΤΑΘΕΡΑ ΕΜΕΙΝΕ ΠΙΣΩ, ΚΑΙ ΤΟ ΕΔΕΙΞΕ ΤΟ TEST. Ο
 * μετασχηματιστής αναγνώριζε `const NS = …` και **όχι** `const CATALOG_NS = …`, οπότε το
 * `K` μετακόμισε και το πρόθεμα **όχι**: κάθε ετικέτα του καταλόγου θα ζητούσε
 * `search-results:offer.mandates.*` από namespace που **δεν έχει πια** τη ρίζα `offer`.
 * Το έπιασε το `mandate-catalog-labels.test.ts`, που κρίνει **και το πρόθεμα** και όχι
 * μόνο τη διαδρομή — ακριβώς ο λόγος για τον οποίο γράφτηκε έτσι.
 *
 * ⚠️ **ΔΕΝ ταξιδεύει πια ολόκληρο στο κέλυφος** (αυτό έλεγε το παλιό σχόλιο): το
 * `property-market` φτάνει με **per-route slice** στις διαδρομές που το ζητούν.
 */
export const CATALOG_NS = 'property-market';

const K = 'property-market:offer.mandates';

/** Το κοινό κλειδί, ώστε οι σταθερές παρακάτω να διαβάζονται σαν πρόταση. */
export const CATALOG_KEYS = {
  title: `${K}.title`,
  lead: `${K}.lead`,
  create: `${K}.create`,
  /** ADR-827 §9.21 — ο διάδρομος προς τα εισερχόμενα αιτήματα ανάθεσης. */
  inbox: `${K}.inbox`,
  loading: `${K}.loading`,
  error: `${K}.error`,
  retry: `${K}.retry`,
  empty: `${K}.empty`,
  emptyHint: `${K}.emptyHint`,
  truncated: `${K}.truncated`,
  // 🔑 Το `clientUnknown` **μετακόμισε** στο {@link CLIENT_NAME_KEYS} (ADR-834 §6.5.δ):
  //    έγινε **μία από δύο** άγνοιες, και δύο κλειδιά που απαντούν στο ίδιο ερώτημα
  //    θέλουν **έναν** πίνακα — αλλιώς η επόμενη οθόνη θα διάλεγε το «λάθος μισό».
  clientLabel: `${K}.clientLabel`,
  expiresIn: `${K}.expiresIn`,
  expiredLabel: `${K}.expiredLabel`,
  onTheMarket: `${K}.onTheMarket`,
  offTheMarket: `${K}.offTheMarket`,
  notifiedNever: `${K}.notifiedNever`,
  viewedNever: `${K}.viewedNever`,
  groupCount: `${K}.groupCount`,
  working: `${K}.action.working`,
  networkFailure: `${K}.reject.network`,
} as const;

/** Ο τίτλος κάθε **ομάδας** — εξαντλητικά. */
export const GROUP_LABEL_KEYS: Record<MandateStandingGroup, string> = {
  'needs-us': `${K}.group.needs-us`,
  'waiting-client': `${K}.group.waiting-client`,
  expiring: `${K}.group.expiring`,
  settled: `${K}.group.settled`,
  closed: `${K}.group.closed`,
};

/** Το **όνομα** κάθε κατάστασης. */
export const STANDING_LABEL_KEYS: Record<MandateStanding, string> = {
  'unannounced-live': `${K}.standing.unannounced-live`,
  'never-notified': `${K}.standing.never-notified`,
  'link-revoked': `${K}.standing.link-revoked`,
  'expiring-soon': `${K}.standing.expiring-soon`,
  'awaiting-decision': `${K}.standing.awaiting-decision`,
  'awaiting-view': `${K}.standing.awaiting-view`,
  declined: `${K}.standing.declined`,
  expired: `${K}.standing.expired`,
  'expired-unanswered': `${K}.standing.expired-unanswered`,
  live: `${K}.standing.live`,
};

/**
 * **Τι να κάνει ο μεσίτης** σε κάθε κατάσταση.
 *
 * 🔑 Ξεχωριστό από το όνομα, και είναι η ουσία της οθόνης: ένα «Δεν στάλθηκε ποτέ» που
 * δεν λέει *τι να κάνεις γι' αυτό* είναι **διάγνωση χωρίς θεραπεία**. Το MLS δίνει
 * μόνο το πρώτο.
 *
 * 🔴 **ΚΑΙ ΜΙΑ ΑΠΟ ΑΥΤΕΣ ΤΙΣ ΠΡΟΤΑΣΕΙΣ ΕΛΕΓΕ ΑΙΤΙΑ ΠΟΥ ΚΑΝΕΙΣ ΔΕΝ ΚΑΤΕΓΡΑΨΕ**
 * (ADR-834 §6.5.δ). Το `never-notified` έγραφε *«Η επαφή δεν είχε διεύθυνση email τη
 * στιγμή της καταχώρησης»* — για επαφή που **είχε** email (μετρημένο ζωντανά
 * 2026-08-31). Ο πίνακας εδώ διαβάζει **μία** μεταβλητή, την κατάσταση· η αιτία είναι
 * **δεύτερος άξονας** και ζει στο {@link NEVER_NOTIFIED_HINT_KEYS}. Η πρόταση εδώ
 * είναι πλέον **ουδέτερη ως προς την αιτία** — δες {@link standingHintKeyFor}.
 */
export const STANDING_HINT_KEYS: Record<MandateStanding, string> = {
  'unannounced-live': `${K}.standingHint.unannounced-live`,
  'never-notified': `${K}.standingHint.never-notified`,
  'link-revoked': `${K}.standingHint.link-revoked`,
  'expiring-soon': `${K}.standingHint.expiring-soon`,
  'awaiting-decision': `${K}.standingHint.awaiting-decision`,
  'awaiting-view': `${K}.standingHint.awaiting-view`,
  declined: `${K}.standingHint.declined`,
  expired: `${K}.standingHint.expired`,
  'expired-unanswered': `${K}.standingHint.expired-unanswered`,
  live: `${K}.standingHint.live`,
};

/**
 * **Η απουσία καταγραφής, ως μέλος του άξονα** — ποτέ ωμό `'unrecorded'` στον κώδικα.
 *
 * 🔑 Ξεχωριστό όνομα από το `null` επίτηδες: το `null` είναι *«το πεδίο δεν έχει
 * τιμή»*, αυτό είναι *«**αυτό λέμε** όταν δεν έχει»*. Το πρώτο ζει στη βάση, το
 * δεύτερο στην οθόνη.
 */
export const NOTIFY_UNRECORDED = 'unrecorded';

/** Ο **δεύτερος άξονας** της θεραπείας: τρεις εκβάσεις **συν** την απουσία τους. */
export type NotifyHintAxis = MandateNotifyOutcome | typeof NOTIFY_UNRECORDED;

/**
 * 🔴 **ΓΙΑΤΙ ΔΕΝ ΣΤΑΛΘΗΚΕ — ΜΟΝΟ ΟΠΟΥ Η ΑΙΤΙΑ ΕΧΕΙ ΚΑΤΑΓΡΑΦΕΙ** (ADR-834 §6.5.δ).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΚΛΕΙΔΙ ΤΟΥ ΠΙΝΑΚΑ ΕΙΝΑΙ Η ΕΚΒΑΣΗ, ΚΑΙ ΤΟ `unrecorded` ΕΙΝΑΙ ΜΕΛΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο τύπος είναι **ολικός** πάνω στο {@link MandateNotifyOutcome} **συν** την απουσία —
 * δηλαδή **τέσσερα** κλειδιά, όχι τρία. Ένα `Partial` με `??` εφεδρεία θα ήταν
 * **σιωπηλή προεπιλογή**: μια τέταρτη έκβαση θα προσγειωνόταν στο γενικό κείμενο και
 * κανείς δεν θα το μάθαινε ποτέ. Έτσι, ο μεταγλωττιστής ρωτά *«και τι λέμε γι' αυτή;»*
 * τη στιγμή που κάποιος προσθέτει έκβαση.
 *
 * ⚠️ **`unrecorded` ΔΕΝ σημαίνει «όλα καλά»** — σημαίνει *«δεν ξέρουμε γιατί»*, και
 * το κείμενό του **δεν επιτρέπεται** να ονομάσει αιτία. Είναι δύο νόμιμοι κόσμοι:
 * εντολή γραμμένη πριν από αυτό το πεδίο, και εντολή που γεννήθηκε **χωρίς να
 * επιχειρηθεί** ειδοποίηση. Ίδιο μάθημα με το `undetermined` του κριτή κατάληψης.
 *
 * ⚠️ **Το `sent` δείχνει στο ΓΕΝΙΚΟ κείμενο επίτηδες.** «Έφυγε» μαζί με «δεν στάλθηκε
 * ποτέ» είναι **ασυμφωνία**, δομικά αδύνατη στους δύο γραφείς μας (τα δύο πεδία
 * γράφονται στην ίδια γραφή). Αν παρόλα αυτά εμφανιστεί, το σωστό είναι να **μην
 * ισχυριστούμε αιτία** — όχι να επινοήσουμε ενδέκατη κατάσταση για έγγραφο που
 * κάποιος πείραξε με το χέρι.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΚΑΙ ΓΙΑΤΙ **ΔΕΝ** ΥΠΑΡΧΕΙ `standingHintKeyFor(standing, outcome)` — ΜΕΤΡΗΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πρώτη γραφή του §6.5.δ **είχε** τέτοια συνάρτηση, και η οθόνη καλούσε
 * `t(standingHintKeyFor(row.standing, row.notifyOutcome))`. **Ο generator του route
 * slice ΑΡΝΗΘΗΚΕ να παράγει**: η σκάλα ταξινόμησης του ADR-744
 * (`lib/i18n-shell-slice/key-extract.js`) ανεβαίνει σε κυριολεξία, **τριαδικό**,
 * πρότυπο με σταθερές, `??`/`||`, **πρόσβαση σε πίνακα σταθερών** και αναγνωριστικό —
 * και **σταματά εκεί**. Μια **κλήση συνάρτησης** πέφτει από το τελευταίο σκαλί ⇒
 * `unresolved` ⇒ καμία εκπομπή slice ⇒ **ωμά κλειδιά στην οθόνη του καταλόγου**.
 *
 * 🔑 **Δηλαδή ο ίδιος ο κανόνας του §9 ξαναχτύπησε, από την ανάποδη**: η «καθαρή
 * αφαίρεση» θα ήταν σωστή σαν κώδικας και **αόρατη** στο εργαλείο που φυλά την οθόνη.
 * Η θεραπεία δεν είναι εξαίρεση στο `dynamicKeyPolicy` — αυτό θα μεγάλωνε ακριβώς τον
 * σωρό των **ανεπίλυτων** που κρατά τα route slices νεκρά (ADR-777 §8.33). Η θεραπεία
 * είναι **να μείνει η επιλογή ΔΕΔΟΜΕΝΟ**: δύο πίνακες και **ένα τριαδικό** στο σημείο
 * κλήσης, που η σκάλα διαβάζει και **στα δύο** σκέλη.
 *
 * ⚠️ **Και το «ένα σημείο» δεν χάθηκε**: το σημείο είναι η **μία** γραμμή του
 * `MandateCatalogRow`, και το ερώτημα *«τι λέει ΑΥΤΗ η οθόνη;»* το εκτελεί άγκυρα
 * **πάνω στο component** — ίδιο συμβόλαιο με το `occupancy-line-unknown-scope.test.tsx`.
 * Μια άγκυρα πάνω σε βοηθητική συνάρτηση θα ήταν πράσινη ενώ η οθόνη έδειχνε κλειδιά.
 */
export const NEVER_NOTIFIED_HINT_KEYS: Record<NotifyHintAxis, string> = {
  'no-address': `${K}.neverNotifiedHint.no-address`,
  failed: `${K}.neverNotifiedHint.failed`,
  sent: `${K}.standingHint.never-notified`,
  unrecorded: `${K}.standingHint.never-notified`,
};

/**
 * **ΠΩΣ ΛΕΓΕΤΑΙ Ο ΠΕΛΑΤΗΣ ΟΤΑΝ ΔΕΝ ΛΕΓΕΤΑΙ** — δύο άγνοιες, δύο κείμενα.
 *
 * 🔴 Ήταν **ένα** κλειδί (`clientUnknown`, *«Η επαφή δεν βρέθηκε»*) για **δύο**
 * κόσμους: διαγραμμένη επαφή, και επαφή **χωρίς όνομα** που υπάρχει μια χαρά
 * (ADR-834 §6.5.δ). Οι θεραπείες είναι διαφορετικές — *ξαναδέσε τον πελάτη* ⇄
 * *συμπλήρωσε την καρτέλα* — άρα το μήνυμα οφείλει να είναι διαφορετικό.
 *
 * 🔑 **Το `known` ΔΕΝ έχει κλειδί, και δεν πρέπει να αποκτήσει**: εκεί τυπώνεται το
 * **όνομα του ανθρώπου**, όχι κείμενο δικό μας. Ο τύπος το λέει με `Exclude`, ώστε ένα
 * μελλοντικό `${K}.clientKnown` να μη μεταγλωττίζεται καν.
 */
export const CLIENT_NAME_KEYS: Record<
  Exclude<MandateClientName['kind'], typeof CLIENT_NAME_KNOWN>,
  string
> = {
  missing: `${K}.clientUnknown`,
  unnamed: `${K}.clientUnnamed`,
};

/** Η **προέλευση** της έγκρισης — ποτέ κρυμμένη από τον κατάλογο. */
export const PROOF_LABEL_KEYS: Record<MandateProofVia, string> = {
  'owner-consent': `${K}.proof.owner-consent`,
  'agency-attestation': `${K}.proof.agency-attestation`,
};

/** Οι δύο πράξεις. */
export const ACTION_LABEL_KEYS = {
  resend: `${K}.action.resend`,
  revoke: `${K}.action.revoke`,
} as const;

/** Τι λέμε όταν **πέτυχε** η πράξη. */
export const ACTION_DONE_KEYS = {
  resend: `${K}.actionDone.resend`,
  revoke: `${K}.actionDone.revoke`,
} as const;

/**
 * **Η πράξη παρουσίας** — «κατέβασέ το» / «ανέβασέ το» (ADR-777 §8.39).
 *
 * 🔑 Ξεχωριστό `Record` από το {@link ACTION_LABEL_KEYS}, γιατί είναι **άλλη μηχανή
 * καταστάσεων**: εκείνο μιλά για την **πρόσκληση**, αυτό για την **αγγελία**.
 */
export const PRESENCE_LABEL_KEYS: Record<PresenceAction, string> = {
  withdraw: `${K}.presence.withdraw`,
  restore: `${K}.presence.restore`,
};

/** Τι λέμε όταν **πέτυχε** η πράξη παρουσίας. */
export const PRESENCE_DONE_KEYS: Record<PresenceAction, string> = {
  withdraw: `${K}.presenceDone.withdraw`,
  restore: `${K}.presenceDone.restore`,
};

/** Τι λέμε όταν ο διακομιστής **αρνήθηκε** — κάθε λόγος με δικό του κείμενο. */
export const REJECTION_KEYS: Record<MandateActionRejection, string> = {
  absent: `${K}.reject.absent`,
  'not-brokered': `${K}.reject.not-brokered`,
  declined: `${K}.reject.declined`,
  expired: `${K}.reject.expired`,
  'not-pending': `${K}.reject.not-pending`,
  'already-revoked': `${K}.reject.already-revoked`,
  'no-address': `${K}.reject.no-address`,
  'write-failed': `${K}.reject.write-failed`,
};
