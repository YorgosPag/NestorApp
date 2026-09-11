'use client';

/**
 * @fileoverview **ΤΑ ΚΕΙΜΕΝΑ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ** — ΕΝΑΣ πίνακας ανά λεξιλόγιο.
 * @related components/mandate/mandate-request-form-labels.ts (το πρότυπο) · ADR-843 §10
 * @module components/contact/first-contact-labels
 *
 * 🔴 **ΓΙΑΤΙ ΑΡΧΕΙΟ ΑΝΑ ΒΑΣΗ**: η `dynamicKeyPolicy` του τεμαχιστή ζει **ανά ΑΡΧΕΙΟ**.
 * Κοινό αρχείο με όρισμα `base` θα δήλωνε **όλες** τις ρίζες, και **κάθε** διαδρομή με
 * φόρμα θα κουβαλούσε **όλα** τα λεξιλόγια.
 *
 * 🔑 **ΚΥΡΙΟΛΕΚΤΙΚΟΙ ΠΙΝΑΚΕΣ, ΟΧΙ SPREAD**: ο εξαγωγέας διαβάζει **τιμές σταθεράς
 * module**· ένα `{...A, ...B}` **δεν διαβάζεται** και βγαίνει *«unresolved dynamic
 * t()»*. ⛔ **ΜΗΝ** το λύσεις με `dynamicKeyPolicy` — θα έκρυβε τα κλειδιά από τη
 * **CHECK 3.8**.
 *
 * ⚠️ Κάθε `Record` είναι **πλήρης πάνω στο κλειστό σύνολο**: νέος κωδικός άρνησης ή
 * αμετάβλητου **δεν μεταγλωττίζεται** χωρίς κλειδί. Αυτό ακριβώς έπιασε το
 * `listing-conflicting-mandate` στο γειτονικό υποσύστημα, αφού είχε ήδη σταλεί ζωντανά.
 */

import { FIRST_CONTACT_INVARIANTS, type FirstContactInvariant } from '@/types/first-contact';
import { FIRST_CONTACT_REJECTIONS, type FirstContactRejection } from '@/services/contact/first-contact-vocabulary';
import {
  FIRST_CONTACT_FORM_BLOCKERS,
  type FirstContactFormBlocker,
} from '@/lib/contact/first-contact-form-values';
import { MY_FIRST_CONTACTS_ROUTE } from '@/lib/contact/first-contact-routes';
import {
  FIRST_CONTACT_CHANNELS,
  type FirstContactChannel,
} from '@/lib/contact/first-contact-channel';

export { FIRST_CONTACT_NS } from './first-contact-namespace';

/**
 * **Οι πέντε αρνήσεις του διακομιστή** — *«ο κόσμος δεν το επιτρέπει»*.
 *
 * 🔑 Χωριστός πίνακας από τα {@link INVARIANT_KEYS} επειδή είναι **άλλη ερώτηση**: εδώ
 * ο άνθρωπος δεν έκανε λάθος — άλλαξε ο κόσμος, ή δεν του ανήκει η πράξη.
 */
export const REJECTION_KEYS: Record<FirstContactRejection, string> = {
  'target-absent': 'property-market:contact.first.target-absent',
  'target-not-live': 'property-market:contact.first.target-not-live',
  'contact-own-target': 'property-market:contact.first.contact-own-target',
  /**
   * ⛔ **ΤΟ ΚΕΙΜΕΝΟ ΔΕΝ ΛΕΕΙ «ΑΝΑΒΑΘΜΙΣΕ»** (Κ9, **απόλυτο**) — λέει *«κλείσε κάποια
   * από τις ανοιχτές»*, και η **μόνη** διέξοδος αυτού του πίνακα δείχνει στις δικές
   * του επαφές. Ένα όριο που πουλιέται παύει να είναι προστασία και γίνεται προϊόν.
   *
   * ⚠️ Το **{capacity}** έρχεται από τον διακομιστή, ώστε η οθόνη να **μην ξαναγράψει
   * το δέκα**. Δεύτερος αριθμός θα ήταν δεύτερη αυθεντία.
   */
  'capacity-full': 'property-market:contact.first.capacity-full',
  'demand-absent': 'property-market:contact.first.demand-absent',
};

/**
 * **Τα εμπόδια της ΦΟΡΜΑΣ** — *«αυτό που βλέπω δεν μπορεί να σταλεί»*.
 *
 * 🔑 **ΤΡΙΤΟΣ πίνακας, και είναι ΑΛΛΗ ΣΤΙΓΜΗ**: τα {@link REJECTION_KEYS} τα μαθαίνει ο
 * άνθρωπος **μετά** την υποβολή· αυτά τα βλέπει **πληκτρολογώντας**, δίπλα στο πεδίο.
 * Ίδιο σχήμα με το `TEXT_KEYS` / `REJECTION_KEYS` του γειτονικού υποσυστήματος.
 *
 * ⚠️ **Δεν διπλασιάζουν τα {@link INVARIANT_KEYS}** παρότι λένε παρόμοια πράγματα: ο
 * διακομιστής κρίνει την **πράξη** και μιλά για ό,τι **στάλθηκε**· εδώ μιλάμε για ό,τι
 * ο άνθρωπος **βλέπει μπροστά του**, και το μήνυμα λέει την **απαίτηση** *(«αφήστε
 * email ή τηλέφωνο»)* αντί για την παράβαση *(«λείπει κανάλι»)* — κανόνας Baymard.
 */
export const FORM_BLOCKER_KEYS: Record<FirstContactFormBlocker, string> = {
  'contact-name-unset': 'property-market:contact.first.contact-name-unset',
  'contact-email-unset': 'property-market:contact.first.contact-email-unset',
  'contact-email-malformed': 'property-market:contact.first.contact-email-malformed',
  'contact-phone-malformed': 'property-market:contact.first.contact-phone-malformed',
};

/**
 * **Τα πέντε αμετάβλητα** — *«λείπει κάτι δικό σου»*.
 *
 * 🔴 **ΥΠΑΡΧΟΥΝ ΕΠΕΙΔΗ Ο ΜΕΤΑΦΟΡΕΑΣ ΜΑΘΕ ΝΑ ΤΑ ΔΙΑΒΑΖΕΙ** (Στάδιο Γ). Πριν από αυτό,
 * το `INVALID_CONTACT` έπεφτε στο `catch` και γινόταν *«κάτι πήγε στραβά»* — δηλαδή τα
 * κλειδιά θα υπήρχαν και **δεν θα εμφανίζονταν ποτέ**.
 *
 * ⚠️ **Τα τρία τελευταία λένε επίτηδες το ίδιο γενικό**, και **δεν** είναι τεμπελιά:
 * `withdrawal-timeless` · `foreign-id` · `reason-without-demand` περιγράφουν **δική μας
 * αστοχία**, όχι δική του. Ένα ονομαστικό μήνυμα εκεί θα ζητούσε από τον άνθρωπο να
 * καταλάβει το σχήμα της βάσης μας για να διορθώσει κάτι που **δεν έγραψε ποτέ**.
 * Ενεργήσιμα είναι μόνο τα **δύο πρώτα** — και αυτά μιλούν ονομαστικά.
 */
export const INVARIANT_KEYS: Record<FirstContactInvariant, string> = {
  'contact-no-name': 'property-market:contact.first.contact-no-name',
  'contact-no-channel': 'property-market:contact.first.contact-no-channel',
  'contact-withdrawal-timeless': 'property-market:contact.first.contact-withdrawal-timeless',
  'contact-foreign-id': 'property-market:contact.first.contact-foreign-id',
  'contact-reason-without-demand': 'property-market:contact.first.contact-reason-without-demand',
};

/**
 * **Η ΔΙΕΞΟΔΟΣ ΚΑΘΕ ΑΡΝΗΣΗΣ** — λόγος **και** δυνατότητα διόρθωσης.
 *
 * 🔴 **ΠΛΗΡΗΣ `Record` ΜΕ `null`, ΟΧΙ `Partial`**: ένα `Partial` θα σήμαινε *«όποιος
 * έχει, έχει»* — ο **έκτος** κωδικός θα γεννιόταν σιωπηλά χωρίς διέξοδο. Το `null`
 * είναι **απάντηση** στην ερώτηση *«μπορεί να κάνει κάτι, εδώ και τώρα;»*, όχι παράλειψη.
 *
 * ⚠️ **Τα τέσσερα `null` δεν είναι αδιαφορία**: `target-absent` ⇒ ο σύνδεσμος είναι
 * μπαγιάτικος· `contact-own-target` ⇒ δεν υπάρχει τίποτα να διορθωθεί. Σύνδεσμος εκεί
 * θα έβγαζε τον άνθρωπο από τη δουλειά του για να τον ξαναφέρει πίσω.
 */
export interface RejectionRemedy {
  readonly href: string;
  readonly labelKey: string;
}

/**
 * ⚠️ **Η διεύθυνση ΔΕΝ γράφεται εδώ** — ζει στο `lib/contact/first-contact-routes.ts`
 * (ADR-843 §10.19). Ζούσε ως `MY_CONTACTS_ROUTE = '/contacts'` σε αυτό το αρχείο
 * **ετικετών**, και η λάθος θέση έκρυψε τη λάθος τιμή: το `/contacts` ανήκει στο γραφείο.
 */
export const REJECTION_REMEDY: Record<FirstContactRejection, RejectionRemedy | null> = {
  'target-absent': null,
  'target-not-live': null,
  'contact-own-target': null,
  'capacity-full': {
    href: MY_FIRST_CONTACTS_ROUTE,
    labelKey: 'property-market:contact.first.capacity-full-action',
  },
  'demand-absent': null,
};

/** Τα υπόλοιπα κείμενα της **πράξης** — κουμπί, διάλογος, εκβάσεις. */
export const ACT_KEYS = {
  cta: 'property-market:contact.first.cta',
  ctaPro: 'property-market:contact.first.ctaPro',
  ctaHint: 'property-market:contact.first.ctaHint',
  /**
   * **ΤΙ ΜΠΑΙΝΕΙ ΣΤΗ ΘΕΣΗ ΤΟΥ ΚΟΥΜΠΙΟΥ** όταν η ήσυχη ερώτηση απαντήσει «όχι» (§10.18).
   *
   * 🔑 **ΔΕΝ ΤΑΞΙΔΕΥΟΥΝ ΣΤΟ ΠΡΩΤΟ ΒΑΨΙΜΟ, ΚΑΙ ΕΙΝΑΙ ΔΟΜΙΚΟ**: τα ζωγραφίζει **μόνο** ο
   * {@link FirstContactStandIn}, που φορτώνεται **τεμπέλικα** — για τον **ίδιο**
   * μετρημένο λόγο με τον διάλογο *(CHECK 3.34, ADR-744)*. Δεν μπορούν να φανούν πριν
   * μάθουμε **ποιος** κοιτάζει, και το μαθαίνουμε μόνο μετά από αίτημα δικτύου· άρα
   * μηδέν επιβάρυνση στη στατική κλειστότητα των **δύο δημόσιων** διαδρομών.
   *
   * ⚠️ **Ο ιδιοκτήτης ακούει ΤΙ ΕΙΝΑΙ, όχι τι ΔΕΝ ΜΠΟΡΕΙ.** Το `contact-own-target`
   * (*«είναι δικό σας»*) είναι σωστό **μετά** από υποβολή· **πριν**, ο άνθρωπος δεν
   * προσπάθησε τίποτα — ήρθε να δει τη σελίδα του. Άρνηση σε κάτι που δεν ζήτησε είναι
   * απάντηση σε λάθος ερώτηση.
   */
  ownListingTitle: 'property-market:contact.first.ownListingTitle',
  ownListingLead: 'property-market:contact.first.ownListingLead',
  ownListingAction: 'property-market:contact.first.ownListingAction',
  ownProTitle: 'property-market:contact.first.ownProTitle',
  ownProLead: 'property-market:contact.first.ownProLead',
  /**
   * ⚠️ **Χωριστά από τα `alreadyOpen*`, και ΔΕΝ είναι διπλότυπο**: εκείνα μιλούν
   * **μετά** την υποβολή (*«δεν στάλθηκε τίποτα δεύτερη φορά»*) — πρόταση που είναι
   * **αναληθής** πριν πατήσει κανείς. Ίδιο γεγονός, **άλλη στιγμή**, άλλος χρόνος
   * ρήματος.
   */
  alreadySentTitle: 'property-market:contact.first.alreadySentTitle',
  alreadySentLead: 'property-market:contact.first.alreadySentLead',
  dialogTitle: 'property-market:contact.first.dialogTitle',
  dialogLead: 'property-market:contact.first.dialogLead',
  nameLabel: 'property-market:contact.first.nameLabel',
  emailLabel: 'property-market:contact.first.emailLabel',
  phoneLabel: 'property-market:contact.first.phoneLabel',
  /**
   * Η υπόδειξη του **τηλεφώνου**. ⚠️ Το κλειδί κράτησε το παλιό του όνομα επίτηδες:
   * το κείμενο άλλαξε *(«άφησε έναν τρόπο»* ⇒ *«προαιρετικό»)*, αλλά η **θέση** του —
   * τελευταίο πεδίο — και ο ρόλος του δεν άλλαξαν. Μετονομασία θα κόστιζε αλλαγή σε
   * δύο locales, τον τύπο i18n και την οθόνη, για **μηδέν** κέρδος αναγνωσιμότητας.
   */
  channelHint: 'property-market:contact.first.channelHint',
  submit: 'property-market:contact.first.submit',
  submitting: 'property-market:contact.first.submitting',
  cancel: 'property-market:contact.first.cancel',
  openedTitle: 'property-market:contact.first.openedTitle',
  openedLead: 'property-market:contact.first.openedLead',
  alreadyOpenTitle: 'property-market:contact.first.alreadyOpenTitle',
  alreadyOpenLead: 'property-market:contact.first.alreadyOpenLead',
  seeMine: 'property-market:contact.first.seeMine',
  failed: 'property-market:contact.first.failed',
  unavailable: 'property-market:contact.first.unavailable',
  issuesHeading: 'property-market:contact.first.issuesHeading',
  /** Ο τίτλος της **σύνοψης σφαλμάτων** — πρότυπο GOV.UK, εστιάζεται στην υποβολή. */
  errorSummaryTitle: 'property-market:contact.first.errorSummaryTitle',
  optionalSuffix: 'property-market:contact.first.optionalSuffix',
  requiredSuffix: 'property-market:contact.first.requiredSuffix',
  closeAfterDone: 'property-market:contact.first.closeAfterDone',
} as const;

/**
 * **ΤΙ ΘΑ ΣΥΜΒΕΙ ΜΟΛΙΣ ΠΑΤΗΣΕΙ — ανά κανάλι** (ADR-844 §12). Η γραμμή **πριν** το κουμπί.
 *
 * 🔴 **ΑΝΤΙΚΑΤΕΣΤΗΣΕ ΤΟ ΕΝΙΑΙΟ `accountNotice`** (2026-09-11), που έλεγε *«σας στέλνουμε
 * σύνδεσμο επιβεβαίωσης»* **και** στον συνδεδεμένο με επιβεβαιωμένο email — για τον οποίο
 * η πράξη φεύγει αμέσως και **δεν στέλνεται τίποτα**. Ένα κείμενο για τέσσερις συνέπειες
 * είναι ψέμα για τις τρεις.
 *
 * 🔑 **Η φόρμα διαλέγει γραμμή με την ΙΔΙΑ τιμή `channel` που διαλέγει τον δρόμο στον
 * διάλογο** (`lib/contact/first-contact-channel.ts`) ⇒ κείμενο και πράξη **δεν μπορούν**
 * να διαφωνήσουν. Πλήρες `Record`: πέμπτο κανάλι δεν μεταγλωττίζεται χωρίς κείμενο.
 *
 * ⚖️ **Το `guest` ΕΙΝΑΙ Η ΓΡΑΜΜΗ ΤΟΥ EDPB** (*Recommendations 2/2025*, ADR-844 απόφαση #1):
 * υποχρεωτικός λογαριασμός μόνο όταν είναι αντικειμενικά απαραίτητος, και ρητή ενημέρωση
 * για το **γιατί**, **πριν** το κουμπί — ενημέρωση μετά την πράξη είναι ανακοίνωση. Το ίδιο
 * ισχύει για το `foreign-address`, που επίσης μπορεί να **γεννήσει** λογαριασμό. Άγκυρες
 * αλήθειας στο `first-contact-labels.test.ts` απαιτούν να τον ονομάζουν.
 */
export const CHANNEL_NOTICE_KEYS: Record<FirstContactChannel, string> = {
  proven: 'property-market:contact.first.channelNotice.proven',
  'unverified-account': 'property-market:contact.first.channelNotice.unverified-account',
  guest: 'property-market:contact.first.channelNotice.guest',
  'foreign-address': 'property-market:contact.first.channelNotice.foreign-address',
};

/**
 * **Η υπόδειξη του email, ανά κανάλι** — *«εδώ πάει ο σύνδεσμος»* **μόνο** όπου πάει.
 *
 * ⚠️ Αντικατέστησε το ενιαίο `emailHint` για τον ίδιο λόγο με τον {@link CHANNEL_NOTICE_KEYS}.
 * Τα `guest` και `foreign-address` λένε **επίτηδες** το ίδιο: και στα δύο το πεδίο είναι
 * ελεύθερο και ο σύνδεσμος πηγαίνει εκεί. Δύο γραμμές, γιατί είναι δύο **κανάλια** — ένα
 * κοινό κλειδί θα έδενε δύο κείμενα που κάποια μέρα θα θέλουν να διαφέρουν.
 */
export const CHANNEL_EMAIL_HINT_KEYS: Record<FirstContactChannel, string> = {
  proven: 'property-market:contact.first.channelEmailHint.proven',
  'unverified-account': 'property-market:contact.first.channelEmailHint.unverified-account',
  guest: 'property-market:contact.first.channelEmailHint.guest',
  'foreign-address': 'property-market:contact.first.channelEmailHint.foreign-address',
};

/** **«Ποιους πλησίασα»** — και το υπόλοιπο χωρητικότητας. */
export const MINE_KEYS = {
  title: 'property-market:contact.mine.title',
  lead: 'property-market:contact.mine.lead',
  capacity: 'property-market:contact.mine.capacity',
  capacityFull: 'property-market:contact.mine.capacityFull',
  loading: 'property-market:contact.mine.loading',
  failed: 'property-market:contact.mine.failed',
  retry: 'property-market:contact.mine.retry',
  empty: 'property-market:contact.mine.empty',
  emptyLead: 'property-market:contact.mine.emptyLead',
  openBadge: 'property-market:contact.mine.openBadge',
  withdrawnBadge: 'property-market:contact.mine.withdrawnBadge',
  seenAt: 'property-market:contact.mine.seenAt',
  seenNever: 'property-market:contact.mine.seenNever',
  withdrawnAt: 'property-market:contact.mine.withdrawnAt',
  requestedAt: 'property-market:contact.mine.requestedAt',
  targetListing: 'property-market:contact.mine.targetListing',
  targetProfessional: 'property-market:contact.mine.targetProfessional',
  withdraw: 'property-market:contact.mine.withdraw',
  withdrawTitle: 'property-market:contact.mine.withdrawTitle',
  /**
   * ⛔ **ΠΟΤΕ «διαγράφονται τα στοιχεία σου»** (Κ10). Το κείμενο λέει *«σταματά η
   * πρόσβαση από εδώ — ό,τι είδε, το είδε»*, γιατί ο άλλος μπορεί να έχει το τηλέφωνο
   * σε χαρτί. **Μια υπόσχεση που δεν μπορούμε να κρατήσουμε είναι χειρότερη από καμία.**
   *
   * ⚠️ **Η διατύπωση περνά από δικηγόρο** (Κ11): **δεν** είναι το δικαίωμα στη λήθη.
   */
  withdrawBody: 'property-market:contact.mine.withdrawBody',
  withdrawConfirm: 'property-market:contact.mine.withdrawConfirm',
  withdrawCancel: 'property-market:contact.mine.withdrawCancel',
  withdrawing: 'property-market:contact.mine.withdrawing',
  withdrawFailed: 'property-market:contact.mine.withdrawFailed',
  withdrawAbsent: 'property-market:contact.mine.withdrawAbsent',
} as const;

/** **«Ποιοι με πλησίασαν»** — τα στοιχεία **δίπλα, χωρίς κλικ** (Κ7 #1). */
export const INBOX_KEYS = {
  title: 'property-market:contact.inbox.title',
  lead: 'property-market:contact.inbox.lead',
  loading: 'property-market:contact.inbox.loading',
  failed: 'property-market:contact.inbox.failed',
  retry: 'property-market:contact.inbox.retry',
  empty: 'property-market:contact.inbox.empty',
  emptyLead: 'property-market:contact.inbox.emptyLead',
  newBadge: 'property-market:contact.inbox.newBadge',
  requestedAt: 'property-market:contact.inbox.requestedAt',
  contactHeading: 'property-market:contact.inbox.contactHeading',
  noEmail: 'property-market:contact.inbox.noEmail',
  noPhone: 'property-market:contact.inbox.noPhone',
  acceptsMessages: 'property-market:contact.inbox.acceptsMessages',
  whyHeading: 'property-market:contact.inbox.whyHeading',
  whyAllMet: 'property-market:contact.inbox.whyAllMet',
  whyUnmet: 'property-market:contact.inbox.whyUnmet',
  whyDeclared: 'property-market:contact.inbox.whyDeclared',
  withdrawnNotice: 'property-market:contact.inbox.withdrawnNotice',
  targetListing: 'property-market:contact.inbox.targetListing',
  targetProfessional: 'property-market:contact.inbox.targetProfessional',
} as const;

/**
 * **Οι δύο όψεις ως ζεύγος καρτελών** (ADR-843 §10.19 — πρότυπο LinkedIn Invitation Manager).
 *
 * 🔑 **ΚΑΜΙΑ ΝΕΑ ΕΤΙΚΕΤΑ ΚΑΡΤΕΛΑΣ**: οι καρτέλες λένε ό,τι λένε ήδη οι τίτλοι
 * ({@link MINE_KEYS}`.title` · {@link INBOX_KEYS}`.title`). Δεύτερη διατύπωση της ίδιας
 * όψης θα απέκλινε την πρώτη φορά που κάποιος διόρθωνε τη μία. Νέο είναι **μόνο** το
 * όνομα της πλοήγησης, για τον αναγνώστη οθόνης.
 */
export const VIEWS_KEYS = {
  label: 'property-market:contact.views.label',
} as const;

/**
 * **Ο άξονας που δεν ταιριάζει, με το ΔΙΚΟ του όνομα** — και ζει ήδη στο δέντρο.
 *
 * 🔑 **ΚΑΝΕΝΑ ΝΕΟ ΚΛΕΙΔΙ**: **κάθε** `DemandBlocker` έχει ετικέτα στο
 * `property-market:demand.blocker.*` από την εποχή του ταιριάσματος. Ένας δεύτερος
 * πίνακας εδώ θα ήταν **δεύτερο λεξιλόγιο για την ίδια έννοια** — και θα απέκλινε την
 * πρώτη φορά που κάποιος διόρθωνε τη μία διατύπωση.
 *
 * ⚠️ **Ο ΑΡΙΘΜΟΣ ΑΦΑΙΡΕΘΗΚΕ ΕΠΙΤΗΔΕΣ** (ADR-777 §8.52): έγραφε «20» και πάλιωσε την
 * ώρα που το λεξιλόγιο απέκτησε τα τέσσερα εμπόδια απουσίας. Ένα πλήθος που το φυλάει
 * ήδη άγκυρα πληρότητας δεν χρειάζεται να επαναλαμβάνεται σε πρόζα.
 *
 * ⚠️ Δυναμικό κλειδί **με δηλωμένη ρίζα**: η CHECK 3.8 το δέχεται επειδή το πρόθεμα
 * είναι κυριολεκτικό και το σύνολο των καταλήξεων είναι **κλειστό** (`DEMAND_BLOCKERS`).
 *
 * 🔑 **ΜΕΤΑΚΟΜΙΣΕ ΕΔΩ ΑΠΟ ΤΟ `first-contact-labels.ts`** *(ADR-844)*: η ρίζα που δηλώνει
 * σέρνει **ολόκληρο** το δέντρο αξόνων ζήτησης σε κάθε αρχείο που την εισάγει, και ο
 * **μοναδικός** της καταναλωτής είναι το `ContactInboxRow` — δηλαδή αυτό εδώ το κατάστιχο.
 */
export function demandBlockerKey(blocker: string): string {
  return `property-market:demand.blocker.${blocker}`;
}

/** Οι κωδικοί σε σειρά — για άγκυρες πληρότητας, ώστε **λείπον κλειδί να κοκκινίζει**. */
export const FIRST_CONTACT_LABEL_SOURCES = {
  rejections: FIRST_CONTACT_REJECTIONS,
  invariants: FIRST_CONTACT_INVARIANTS,
  formBlockers: FIRST_CONTACT_FORM_BLOCKERS,
  channels: FIRST_CONTACT_CHANNELS,
} as const;
