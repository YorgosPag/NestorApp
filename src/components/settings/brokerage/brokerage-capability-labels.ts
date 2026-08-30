/**
 * @fileoverview **ΚΩΔΙΚΟΣ → ΚΛΕΙΔΙ ΚΕΙΜΕΝΟΥ** για την οθόνη της μεσιτικής ικανότητας.
 * @related ADR-824 §12.14 · §8 Κ13 · N.11 · CHECK 3.8 · CHECK 3.51
 * @module components/settings/brokerage/brokerage-capability-labels
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ``t(`…status.${status}`)``
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το δυναμικό κλειδί θα ήταν μία γραμμή αντί για τέσσερις. Θα ήταν επίσης **αόρατο στη
 * CHECK 3.8**, που διαβάζει **κυριολεκτικά** ορίσματα του `t()` — κλειδί που λείπει θα
 * προσγειωνόταν πράσινο και θα έβγαινε **ωμό στην οθόνη**. Ίδιο ιδίωμα με το
 * `SHOWCASE_REJECTION_KEYS` της αδελφής οθόνης, που **γι' αυτόν ακριβώς τον λόγο**
 * αντικατέστησε ένα ``t(failureKey(failure))``.
 *
 * 🔑 **Και ο τύπος δίνει κάτι που καμία άγκυρα δεν μπορεί**: το
 * `Record<CapabilityStatus, string>` κάνει μια **πέμπτη** κατάσταση **να μη
 * μεταγλωττίζεται** μέχρι κάποιος να αποφασίσει τι λέει η οθόνη γι' αυτήν — τη στιγμή
 * ακριβώς που πρέπει να το αποφασίσει άνθρωπος.
 *
 * ⚠️ **Το namespace είναι `auth`, και δεν είναι αφηρημάδα.** Ολόκληρο το λεξιλόγιο της
 * ρυθμιζόμενης ικανότητας ζει ήδη εκεί — `brokerage.denyReason.*` *(η φωνή του κριτή,
 * `BROKERAGE_DENY_REASON_KEYS`)* και `brokerage.requirement.*` *(ό,τι γράφει ο γραφέας
 * στη βάση)*. Δεύτερο namespace για την **ίδια** έννοια θα ήταν δεύτερο βιβλίο
 * (ADR-749): η οθόνη θα έλεγε «ανακλήθηκε» με άλλα λόγια από τον κριτή που το αποφάσισε.
 */

import type { CapabilityStatus } from '@/types/organization-capability';

/**
 * **Το namespace, δηλωμένο δίπλα στα κλειδιά** — ποτέ στην οθόνη.
 *
 * 🔑 Το `auth:` **είναι μέρος του κλειδιού**. Αν ζούσε στον καταναλωτή, μια μετακόμιση
 * των κειμένων σε άλλο αρχείο locale θα απαιτούσε αλλαγή σε **δύο** σημεία που μπορούν
 * να αποκλίνουν — και η απόκλιση δεν σπάει τη μεταγλώττιση, ζωγραφίζει **ωμό κλειδί**.
 */
export const BROKERAGE_CAPABILITY_NS = 'auth';

const K = 'auth:brokerage.capability';

export const BROKERAGE_CAPABILITY_KEYS = {
  title: `${K}.title`,
  lead: `${K}.lead`,
  loading: `${K}.loading`,
  statusLabel: `${K}.statusLabel`,
  requirementsTitle: `${K}.requirementsTitle`,
  revocationTitle: `${K}.revocationTitle`,
  revocationMissing: `${K}.revocationMissing`,
  decidedAt: `${K}.decidedAt`,
  declarationTitle: `${K}.declarationTitle`,
  declaredAt: `${K}.declaredAt`,
  gemiLabel: `${K}.gemiLabel`,
  gemiHint: `${K}.gemiHint`,
  gemiPlaceholder: `${K}.gemiPlaceholder`,
  chamberLabel: `${K}.chamberLabel`,
  chamberHint: `${K}.chamberHint`,
  chamberPlaceholder: `${K}.chamberPlaceholder`,
  representativeLabel: `${K}.representativeLabel`,
  representativeHint: `${K}.representativeHint`,
  representativePlaceholder: `${K}.representativePlaceholder`,
  submit: `${K}.submit`,
  submitting: `${K}.submitting`,
  redeclare: `${K}.redeclare`,
  legalNote: `${K}.legalNote`,
  incomplete: `${K}.incomplete`,
} as const;

/**
 * **Το ΟΝΟΜΑ της κατάστασης** — η μία λέξη που μπαίνει δίπλα στο «Κατάσταση».
 *
 * ⚠️ **Χωριστά από το {@link BROKERAGE_STATUS_HEADLINE_KEYS}, επίτηδες.** Το όνομα
 * απαντά *«πού βρίσκομαι;»*, η επικεφαλίδα *«τι κάνω τώρα;»*. Ενωμένα σε ένα κείμενο,
 * η κατάσταση θα ήταν αναγνώσιμη **μόνο** διαβάζοντας μια παράγραφο — και ο άνθρωπος
 * που ανοίγει αυτή τη σελίδα για δέκατη φορά θέλει τη λέξη, όχι την παράγραφο.
 */
export const BROKERAGE_STATUS_NAME_KEYS: Record<CapabilityStatus, string> = {
  unrequested: `${K}.statusName.unrequested`,
  pending: `${K}.statusName.pending`,
  active: `${K}.statusName.active`,
  revoked: `${K}.statusName.revoked`,
};

/**
 * **ΤΕΣΣΕΡΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΤΕΣΣΕΡΙΣ ΘΕΡΑΠΕΙΕΣ** — και καμία δεν είναι η άλλη.
 *
 * 🔴 `revoked` ≠ `unrequested` **επίτηδες** (ADR-824 §5.2): *«δεν ζήτησε ποτέ»* και
 * *«του το πήραμε»* είναι διαφορετικά γεγονότα. Η μετάλλαξη που ενώνει δύο από αυτά
 * τα κλειδιά **οφείλει** να κοκκινίσει την άγκυρα Κ13.
 *
 * ⚠️ Κάθε κείμενο **ονομάζει την πράξη**: δήλωσε · περίμενε · δούλεψε · διάβασε τον
 * λόγο και ξαναδήλωσε. Ένα «δεν επιτρέπεται» χωρίς πράξη στέλνει και τους τέσσερις
 * στο ίδιο αδιέξοδο — το ακριβές ελάττωμα που το `Κ10` διόρθωσε μια οθόνη πιο πέρα.
 */
export const BROKERAGE_STATUS_HEADLINE_KEYS: Record<CapabilityStatus, string> = {
  unrequested: `${K}.headline.unrequested`,
  pending: `${K}.headline.pending`,
  active: `${K}.headline.active`,
  revoked: `${K}.headline.revoked`,
};

/**
 * **Η ΑΠΑΝΤΗΣΗ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ ΣΤΟ «ΤΙ ΛΕΙΠΕΙ» — ΑΝΑΓΝΩΡΙΣΜΕΝΗ, ΟΧΙ ΕΜΠΙΣΤΕΥΜΕΝΗ.**
 *
 * 🔑 **Το πρότυπο είναι το `requirements.currently_due` της Stripe** — και η τεκμηρίωσή
 * της λέει *«inspect the `currently_due` hash and build an onboarding flow that only
 * collects those requirements»*: **ο διακομιστής ονομάζει τι λείπει, ο πελάτης δεν
 * μαντεύει**. Το κερδίζουμε ολόκληρο: μια νέα προϋπόθεση εμφανίζεται στην οθόνη χωρίς
 * νέα έκδοση πελάτη, αρκεί να έχει κείμενο.
 *
 * 🔴 **ΚΑΙ ΕΔΩ ΕΙΝΑΙ ΠΟΥ ΤΟ ΠΡΟΤΥΠΟ ΔΕΝ ΑΡΚΕΙ.** Το `key` του
 * {@link CapabilityRequirement} είναι `string` — έρχεται από τη **βάση**, δηλαδή είναι
 * **είσοδος**. Ένα σκέτο ``t(requirement.key)`` θα ήταν δυναμικό κλειδί από είσοδο:
 * αόρατο στη CHECK 3.8, αόρατο στον τεμαχιστή του ADR-744, και σε κάθε τιμή που δεν
 * έχει κείμενο θα ζωγράφιζε **το ίδιο το κλειδί** στην οθόνη ενός επαγγελματία.
 *
 * ⇒ Ο πίνακας **δεν μεταφράζει· ΑΝΑΓΝΩΡΙΖΕΙ**. Ό,τι είναι εδώ μέσα επιστρέφεται ως
 * **σταθερά module** *(άρα στατικά επιλύσιμη)*· ό,τι δεν είναι, πέφτει σε ρητό,
 * **μεταφρασμένο** «κάτι εκκρεμεί που αυτή η έκδοση δεν αναγνωρίζει».
 *
 * ⚠️ **Ίδιο δόγμα με το `Κ10β`**: άγνωστη τιμή ⇒ **γενικό**, ποτέ εικασία και ποτέ ωμό
 * κλειδί. Η διαφορά από τη Stripe είναι ακριβώς αυτή η γραμμή: εκεί ο πελάτης που
 * συναντά άγνωστη απαίτηση δείχνει **σιωπή ή σκουπίδι**· εδώ δείχνει πρόταση.
 *
 * 🔑 **Η πληρότητα φυλάγεται από ΑΓΚΥΡΑ, όχι από τον τύπο** — και δεν γίνεται αλλιώς:
 * ο γραφέας είναι `server-only`, ο τύπος του `key` είναι `string`. Το `Κ13` **εκτελεί**
 * τον πραγματικό γραφέα και απαιτεί κάθε απαίτηση που γράφει να είναι εδώ μέσα.
 */
export const BROKERAGE_REQUIREMENT_KEYS: Readonly<Record<string, string>> = {
  'auth:brokerage.requirement.adminApproval': 'auth:brokerage.requirement.adminApproval',
};

/**
 * **Το κλειδί για ό,τι ο πίνακας ΔΕΝ αναγνώρισε** — μεταφρασμένο, ποτέ ωμό.
 *
 * ⚠️ **Αντικείμενο και όχι σκέτη σταθερά, ΚΑΙ ΕΙΝΑΙ ΑΠΑΙΤΗΣΗ**: ο τεμαχιστής του ADR-744
 * επιλύει `t(OBJECT.prop)` και `t(TABLE[expr])`, **ποτέ** `t(IDENTIFIER)` — μια εισηγμένη
 * συμβολοσειρά είναι γι' αυτόν **ανεπίλυτη δυναμική κλήση**, ακριβώς όπως θα ήταν μια
 * παρεμβολή. *(Μετρήθηκε 2026-08-30: η πρώτη γραφή με σκέτη σταθερά απορρίφθηκε.)*
 */
export const BROKERAGE_REQUIREMENT_FALLBACK = {
  unknown: 'auth:brokerage.requirement.unknown',
} as const;

/**
 * **Αναγνωρίζει ο πίνακας αυτή την απαίτηση;**
 *
 * 🔴 **ΓΙΑΤΙ ΚΡΙΤΗΣ ΚΑΙ ΟΧΙ ΣΥΝΑΡΤΗΣΗ ΠΟΥ ΕΠΙΣΤΡΕΦΕΙ ΤΟ ΚΛΕΙΔΙ.** Η πρώτη γραφή ήταν
 * `recognizedRequirementKey(key)` και ο καταναλωτής έγραφε
 * ``t(recognizedRequirementKey(requirement.key))`` — δηλαδή **κλειδί από κλήση
 * συνάρτησης**, ακριβώς το ιδίωμα που ο γεννήτορας route slice **αρνείται ονομαστικά**
 * *(«the slice will not guess»)* και που είναι **αόρατο στη CHECK 3.8**. Το ίδιο λάθος
 * είναι ήδη γραμμένο ως μάθημα στο `AgencyShowcaseContent`, όπου ένα
 * ``t(failureKey(failure))`` μπλόκαρε τον γεννήτορα.
 *
 * ⇒ Ο κριτής απαντά **ναι/όχι**, και ο καταναλωτής κρατά και τις δύο κλήσεις `t()` σε
 * μορφή που **επιλύεται στατικά**: ευρετηρίαση σε σταθερά module, ή κυριολεξία.
 */
export function isRecognizedRequirement(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(BROKERAGE_REQUIREMENT_KEYS, key);
}
