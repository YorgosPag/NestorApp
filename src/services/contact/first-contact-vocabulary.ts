/**
 * @fileoverview **ΓΙΑΤΙ ΔΕΝ ΕΓΙΝΕ Η ΠΡΩΤΗ ΕΠΑΦΗ** — το λεξιλόγιο, ποτέ η πράξη.
 * @related services/contact/first-contact.service.ts (ο ΓΡΑΦΕΑΣ) · ADR-843 §10 · ADR-834 §6.2
 * @module services/contact/first-contact-vocabulary
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ, ΓΙΑ ΤΟΝ ΜΕΤΡΗΜΕΝΟ ΛΟΓΟ ΤΟΥ `mandate-request-vocabulary.ts`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο γραφέας είναι `server-only`· το λεξιλόγιο το ζητούν **πελατικά** αρχεία — η
 * μεταφορά ({@link module:services/contact/first-contact.client}) και οι ετικέτες της
 * οθόνης. Όσο ζητούν **τύπο** (`import type`, που σβήνεται στη μεταγλώττιση) δουλεύει
 * κατά τύχη· μια άγκυρα που ζητά την **ΤΙΜΗ** `FIRST_CONTACT_REJECTIONS` θα έσκαγε
 * στον φυλλομετρητή. Το γειτονικό υποσύστημα το **έπαθε** και το κατέγραψε.
 *
 * ⇒ **Layering**: leaf — μόνο τύποι και κυριολεκτικές λίστες. Καμία ανάγνωση, κανένα
 * ρολόι, **κανένα `server-only`**. Ο γραφέας μένει κλειστός.
 */

import { FIRST_CONTACT_INVARIANTS } from '@/types/first-contact';
import type {
  FirstContactForOfferer,
  FirstContactForSeeker,
  FirstContactInvariant,
  FirstContactTarget,
  SeekerDisclosure,
} from '@/types/first-contact';

/**
 * **Γιατί δεν γράφτηκε η πράξη** — κλειστό σύνολο, κάθε κωδικός γίνεται κλειδί i18n.
 *
 * ⚠️ **Η ΒΛΑΒΗ ΔΕΝ ΕΙΝΑΙ ΕΔΩ.** *«Δεν μπόρεσα να ρωτήσω»* είναι `kind: 'unavailable'`
 * και φεύγει ως **503** — ποτέ ως άρνηση (N.12: *άγνωστο ≠ κενό*). Ένα `target-absent`
 * σε βλάβη θα έστελνε τον άνθρωπο μακριά από αγγελία που **υπάρχει**.
 */
export const FIRST_CONTACT_REJECTIONS = [
  /**
   * Ο στόχος δεν υπάρχει — **ή δεν δημοσιεύεται**. Ποτέ χωριστά.
   *
   * 🔑 Για τον **επαγγελματία** αυτό είναι το §9.4 του ADR-827 αυτούσιο: γραφείο που
   * δεν δημοσιεύεται και ψευδώνυμο που δεν υπήρξε ποτέ απαντούν **ταυτόσημα**,
   * αλλιώς η πόρτα γίνεται **μαντείο** *«υπάρχει τέτοιος οργανισμός;»*.
   */
  'target-absent',
  /**
   * Η αγγελία **δεν είναι στην αγορά** — αποσύρθηκε, ή έληξε η εντολή της.
   *
   * ⚠️ **Ξεχωριστός κωδικός από το `target-absent`, και δεν είναι λεπτολογία**: η
   * αγγελία ήταν **δημόσια** όταν ο άνθρωπος την είδε. Ένα «δεν υπάρχει» θα του
   * έλεγε ότι φαντάστηκε τη σελίδα που μόλις διάβαζε. Καμία διαρροή: το ότι
   * **υπήρξε** το ξέρει ήδη.
   */
  'target-not-live',
  /**
   * 🔑 **Πλησιάζεις τον εαυτό σου.** Ο κριτής είναι ο **ένας**
   * (`mayAdminister(custodyOf(…))`, CHECK 3.56) — ο ίδιος που κρίνει την επεξεργασία.
   *
   * ⚠️ Δεν είναι ευπρέπεια: η πράξη θα **ξόδευε θέση χωρητικότητας** (ΠΕ5) και θα
   * γεννούσε εισερχόμενο μήνυμα από τον εαυτό μας — δηλαδή θόρυβο με ημερομηνία.
   */
  'contact-own-target',
  /**
   * 🔴 **Γέμισε η χωρητικότητα** (ΠΕ5, {@link OPEN_CONTACT_CAPACITY}).
   *
   * ⛔ **Η ΘΕΡΑΠΕΙΑ ΔΕΝ ΕΙΝΑΙ ΑΓΟΡΑ** (Κ9, απόλυτο): η οθόνη λέει *«κλείσε κάποια
   * από τις ανοιχτές»*, **ποτέ** *«αναβάθμισε»*. Ένα όριο που πουλιέται παύει να
   * είναι προστασία και γίνεται προϊόν — και εμείς θα ελέγχαμε το νούμερο.
   */
  'capacity-full',
  /**
   * Η ζήτηση που επικαλείσαι **δεν υπάρχει ή δεν είναι δική σου**.
   *
   * 🔑 Το `demandId` είναι **προαιρετικό** στην πράξη (`null` = «δεν δηλώσαμε ποτέ
   * ζήτηση», απόλυτα κανονικό). Αυτός ο κωδικός αφορά **μόνο** την περίπτωση όπου
   * κάποιος **δήλωσε** ταυτότητα ζήτησης που δεν του ανήκει: ένας λόγος χωρίς πηγή
   * θα ταξίδευε στον προσφέροντα ως **γεγονός**.
   */
  'demand-absent',
] as const;

export type FirstContactRejection = (typeof FIRST_CONTACT_REJECTIONS)[number];

/**
 * **Είναι αυτό λόγος που ξέρουμε;** — ο φρουρός του συνόρου προς τα **μέσα**.
 *
 * 🔴 **Γεννήθηκε από μετρημένο περιστατικό στο γειτονικό υποσύστημα** (ADR-834 §6.5.ε):
 * εκεί ο πελάτης έκανε τυφλό `as` στον κωδικό του σώματος. Όσο το σώμα **δεν έφτανε**,
 * το `as` ήταν αβλαβές — και τη μέρα που άρχισε να φτάνει, ένας άγνωστος κωδικός θα
 * γινόταν **ωμό κλειδί στην οθόνη**. Ο έλεγχος υπάρχει **πριν** ανοίξει η πόρτα.
 */
export function isFirstContactRejection(value: unknown): value is FirstContactRejection {
  return typeof value === 'string'
    && (FIRST_CONTACT_REJECTIONS as readonly string[]).includes(value);
}

/**
 * **Είναι αυτό αμετάβλητο που ξέρουμε;** — ο **δεύτερος** φρουρός του ίδιου συνόρου.
 *
 * 🔴 **ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΕΥΡΗΜΑ ΤΟΥ ΣΤΑΔΙΟΥ Γ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΣΧΗΜΑ ΑΠΟ ΤΗΝ ΑΛΛΗ ΑΚΡΗ.**
 * Η πόρτα απαντά **δύο** διακριτά 422 — `CONTACT_REFUSED` *(λόγος)* και
 * `INVALID_CONTACT` *(αμετάβλητα)* — ενώ ο πελατικός μεταφορέας αναγνώριζε **μόνο τον
 * πρώτο**. Το δεύτερο έπεφτε στο `catch` και γινόταν *«κάτι πήγε στραβά»*.
 *
 * ⚠️ **Η συνέπεια ήταν ακριβώς αυτό που το `first-contact-body.ts` πλήρωσε για να
 * αποφύγει**: εκείνο **αρνήθηκε** το `min(1)` στο zod ώστε το *«γράψε πώς σε λένε»* να
 * ταξιδεύει ονομαστικά ως `contact-no-name` αντί για «κακό σώμα» — και ο μεταφορέας
 * πετούσε τη δουλειά του. **Κάλυψη σε νεκρό κλάδο δεν είναι κάλυψη**: τα πέντε κλειδιά
 * i18n των αμετάβλητων θα υπήρχαν και **δεν θα εμφανίζονταν ποτέ**.
 *
 * 🔑 **Γιατί εδώ και όχι στο `types/first-contact.ts`**: εκεί ζει η **λίστα**· εδώ ζει
 * ο **φρουρός του σύρματος**, δίπλα στον αδελφό του {@link isFirstContactRejection},
 * γιατί απαντά την ίδια ερώτηση — *«ήρθε αυτό από σχήμα που αναγνωρίζουμε;»*.
 */
export function isFirstContactInvariant(value: unknown): value is FirstContactInvariant {
  return typeof value === 'string'
    && (FIRST_CONTACT_INVARIANTS as readonly string[]).includes(value);
}

/**
 * **Τι απέγινε η προσπάθεια** — κλειστό σύνολο, ποτέ `boolean` + μήνυμα.
 *
 * 🔑 Το `unchanged` **δεν είναι σφάλμα**: είναι η **επιτυχία** της ιδεμποτησίας.
 * Ο άνθρωπος που πάτησε δύο φορές πρέπει να δει την **πράξη του**, όχι άρνηση για
 * κάτι που πέτυχε — και **δεν επιτρέπεται** να πληρώσει δεύτερη θέση χωρητικότητας.
 *
 * ⚠️ **Επιστρέφεται ΠΡΟΒΟΛΗ, ποτέ το ωμό έγγραφο**: το `first_contacts` είναι
 * `read: false` **και** `write: false`, και η ωμή πράξη κρατά `demandId` (κλειδί προς
 * το επίπεδο Β) που **δεν φεύγει ποτέ** από τον διακομιστή.
 */
export type FirstContactWriteResult =
  | { readonly kind: 'created'; readonly contact: FirstContactForSeeker }
  | { readonly kind: 'unchanged'; readonly contact: FirstContactForSeeker }
  | { readonly kind: 'rejected'; readonly reason: FirstContactRejection }
  | { readonly kind: 'invalid'; readonly violations: readonly FirstContactInvariant[] }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με άρνηση (N.12). */
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'failed' };

/**
 * **Η έτοιμη άρνηση** — γράφεται **μία** φορά, γιατί εμφανίζεται σε έξι σημεία.
 *
 * 🔑 **`Extract` πάνω στην ένωση, ΟΧΙ δεύτερη κυριολεξία**: ένα χειρόγραφο
 * `{ kind: 'rejected'; reason }` θα ήταν **δεύτερος ορισμός** του ίδιου σχήματος, και
 * θα **έπαυε να ταιριάζει** τη μέρα που η έκβαση αποκτούσε πεδίο. Εδώ ο τύπος
 * **παράγεται** από τη μία αλήθεια.
 */
export type FirstContactRefusal = Extract<FirstContactWriteResult, { kind: 'rejected' }>;

export type FirstContactUnavailable = Extract<FirstContactWriteResult, { kind: 'unavailable' }>;

export const refuseFirstContact = (reason: FirstContactRejection): FirstContactRefusal =>
  ({ kind: 'rejected', reason });

/**
 * 🔴 **«Δεν μάθαμε» — ΠΟΤΕ ίδιο με άρνηση** (N.12). Σταθερά, ώστε το `unavailable` να
 * μην ξαναγράφεται ως κυριολεξία σε δέκα σημεία και να «γίνει» κάπου `rejected`.
 */
export const FIRST_CONTACT_UNAVAILABLE: FirstContactUnavailable = { kind: 'unavailable' };

/**
 * **Τι απέγινε η απόσυρση** (ΠΕ6).
 *
 * ⚠️ **Το `absent` σκεπάζει «δεν υπάρχει» ΚΑΙ «δεν είναι δική σου»**, όπως το
 * `listing-absent` του γειτονικού υποσυστήματος: ένα ξεχωριστό «δεν επιτρέπεσαι» θα
 * **επιβεβαίωνε την ύπαρξη** ξένης πράξης σε όποιον μαντεύει ταυτότητες.
 *
 * 🔑 Και εδώ το `unchanged` είναι **επιτυχία**: η δεύτερη απόσυρση δεν μετακινεί τη
 * σφραγίδα χρόνου. Το ΠΕ6 κρατά **πότε** αποσύρθηκε — μία φορά, την πρώτη.
 */
export type FirstContactWithdrawResult =
  | { readonly kind: 'withdrawn'; readonly contact: FirstContactForSeeker }
  | { readonly kind: 'unchanged'; readonly contact: FirstContactForSeeker }
  | { readonly kind: 'absent' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'failed' };

/**
 * **Ό,τι δηλώνει ο ζητών.** ⚠️ **Καμία ταυτότητα χρήστη** — εκείνη έρχεται από την
 * απόδειξη, ποτέ από το σύρμα.
 */
export interface FirstContactDeclaration {
  readonly target: FirstContactTarget;
  /** `null` = «πάτησα το κουμπί χωρίς να έχω δηλώσει ζήτηση». **Κανονικό.** */
  readonly demandId: string | null;
  readonly disclosure: SeekerDisclosure;
}

/**
 * **Ένα εισερχόμενο, όπως το βλέπει ο προσφέρων** — η προβολή {@link
 * FirstContactForOfferer} **αυτούσια**, συν το **ένα** πεδίο που του ανήκει.
 *
 * 🔑 **Επεκτείνει, δεν ξαναγράφει.** Μια δεύτερη κυριολεκτική λίστα πεδίων θα ήταν
 * δεύτερη απόφαση αποκάλυψης — και θα **απέκλινε** από το `disclosedToOfferer` στην
 * πρώτη προσθήκη, σιωπηλά, προς τη λάθος κατεύθυνση.
 *
 * ⚠️ Το `seenAt` είναι **δική του σφραγίδα**: *πότε το είδα εγώ*. Δεν αποκαλύπτει
 * τίποτα για τον ζητούντα — και είναι ο μόνος τρόπος να ξεχωρίσει η οθόνη το νέο
 * από το διαβασμένο χωρίς δεύτερο βιβλίο.
 */
export interface FirstContactInboxEntry extends FirstContactForOfferer {
  readonly seenAt: string | null;
}
