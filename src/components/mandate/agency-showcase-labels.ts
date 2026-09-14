/**
 * @fileoverview **ΚΩΔΙΚΟΣ → ΚΛΕΙΔΙ ΚΕΙΜΕΝΟΥ** για τη βιτρίνα του γραφείου.
 * @related ADR-827 §9.10 · §9.13 στ · N.11 · CHECK 3.8
 * @module components/mandate/agency-showcase-labels
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ``t(`…rejection.${reason}`)``
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το δυναμικό κλειδί θα ήταν μία γραμμή αντί για τρεις. Θα ήταν επίσης **αόρατο στη
 * CHECK 3.8**, που διαβάζει **κυριολεκτικά** ορίσματα του `t()` — κλειδί που λείπει θα
 * προσγειωνόταν πράσινο και θα έβγαινε **ωμό στην οθόνη**.
 *
 * 🔑 **Και ο πίνακας δίνει κάτι που καμία άγκυρα δεν μπορεί**: ο τύπος
 * `Record<AgencyProfileRejection, string>` κάνει τον **τέταρτο** λόγο άρνησης **να μη
 * μεταγλωττίζεται** μέχρι κάποιος να του δώσει κείμενο. Δυναμικό κλειδί θα «δούλευε»
 * και θα ζωγράφιζε `mandate.showcase.rejection.νεος-λογος` στην παραγωγή.
 *
 * ⚠️ **Ο πίνακας ΔΕΝ αντικαθιστά την άγκυρα — τη συμπληρώνει.** Ο μεταγλωττιστής φυλά
 * την **πληρότητα του πίνακα**· μόνο το `form-issue-keys.test.ts` (ομάδα `Μ`) φυλά ότι
 * το κλειδί **έχει λέξεις σε δύο γλώσσες**. Ένας πίνακας που δείχνει σε ανύπαρκτο
 * κλειδί μεταγλωττίζεται μια χαρά.
 */

import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import type { ShowcaseMarkKind } from '@/lib/agency/showcase-mark-kind';
import type { CoverageOutlineDefect } from '@/lib/agency/coverage-outline';
import type { WeeklyHoursDefect } from '@/lib/calendar/weekly-hours';
import type { ShowcaseLocationRole } from '@/types/showcase-card';

/** Το namespace της βιτρίνας — **`property-market`**, το ίδιο με τον κατάλογο. */
export const SHOWCASE_NS = 'property-market';

const K = 'property-market:mandate.showcase';

export const SHOWCASE_KEYS = {
  title: `${K}.title`,
  lead: `${K}.lead`,
  aliasLabel: `${K}.aliasLabel`,
  aliasHint: `${K}.aliasHint`,
  // ── Η ΠΟΡΤΑ ΠΡΟΣ ΤΗ ΔΗΜΟΣΙΑ ΟΨΗ (ADR-841 §7 Α21.11) ──────────────────────
  /** 🔑 *«Δες τη **δημόσια** όψη»* — το μοτίβο της Zillow, αυτολεξεί. */
  publicView: `${K}.publicView`,
  /** ⚠️ **Πράξη**, όχι πλοήγηση: `<button>`, ποτέ `<a>`. */
  copyLink: `${K}.copyLink`,
  linkCopied: `${K}.linkCopied`,
  publicViewHint: `${K}.publicViewHint`,
  nameLabel: `${K}.nameLabel`,
  nameHint: `${K}.nameHint`,
  namePlaceholder: `${K}.namePlaceholder`,
  // ── Η ΕΙΔΙΚΟΤΗΤΑ (Φ6-Β4) ─────────────────────────────────────────────────
  occupationLabel: `${K}.occupationLabel`,
  occupationHint: `${K}.occupationHint`,
  occupationPlaceholder: `${K}.occupationPlaceholder`,
  /** ⚠️ Ελεύθερο κείμενο **δεν** είναι ταξινομημένη ειδικότητα — το λέμε ρητά. */
  occupationUnclassified: `${K}.occupationUnclassified`,
  addOccupation: `${K}.addOccupation`,
  removeOccupation: `${K}.removeOccupation`,
  // ── ΤΟ ΜΗΤΡΩΟ, ΚΑΤΑ ΕΤΥΜΗΓΟΡΙΑ ───────────────────────────────────────────
  /** Η **αρχή** δεν επιλέγεται — ονομάζεται. Το `{{authority}}` έρχεται από τον πίνακα. */
  registryLabel: `${K}.registryLabel`,
  registryHint: `${K}.registryHint`,
  registryPlaceholder: `${K}.registryPlaceholder`,
  chapterLabel: `${K}.chapterLabel`,
  chapterHint: `${K}.chapterHint`,
  chapterPlaceholder: `${K}.chapterPlaceholder`,
  /** 🔑 *«Δεν τηρείται μητρώο. **Δεν σου λείπει τίποτα.**»* — Α9.3, όχι σιωπή. */
  registryNone: `${K}.registryNone`,
  /** 🔑 *«Δεν **έχουμε εξετάσει**…»* — υποκείμενο **εμείς**, ποτέ ο άνθρωπος. */
  registryUnexamined: `${K}.registryUnexamined`,
  placeLabel: `${K}.placeLabel`,
  placeHint: `${K}.placeHint`,
  /**
   * **Η ΔΗΛΩΜΕΝΗ ΕΜΒΕΛΕΙΑ** *(ADR-846)* — «πού δουλεύω», ποτέ «πού κάθομαι».
   *
   * ⚠️ **Το `placeLabel` έλεγε «Πού δραστηριοποιείστε» ενώ αποθήκευε την ΕΔΡΑ** — και το
   * `mandate.profile.placeLabel` έλεγε κατευθείαν «Περιοχή δραστηριότητας». Δηλαδή δύο
   * οθόνες υπόσχονταν εμβέλεια που το πεδίο **δεν** εξέφραζε. Διορθώθηκαν μαζί με αυτή
   * τη δουλειά: η έδρα λέγεται πλέον **έδρα**, και η εμβέλεια απέκτησε δικά της κλειδιά.
   */
  coverageLabel: `${K}.coverageLabel`,
  coverageHint: `${K}.coverageHint`,
  coverageNationwide: `${K}.coverageNationwide`,
  coverageNationwideHint: `${K}.coverageNationwideHint`,
  coverageAddPlaceholder: `${K}.coverageAddPlaceholder`,
  coverageSearchEmpty: `${K}.coverageSearchEmpty`,
  coverageEmpty: `${K}.coverageEmpty`,
  coverageRemove: `${K}.coverageRemove`,
  coverageAbsorbed: `${K}.coverageAbsorbed`,
  coverageLoading: `${K}.coverageLoading`,
  /** Δηλωμένη περιοχή που δεν υπάρχει στην ιεραρχία ⇒ *«διάλεξέ την ξανά»*. */
  coverageAreaUnknown: `${K}.coverageAreaUnknown`,

  // ── Η ΣΥΜΦΩΝΙΑ ΔΗΛΩΣΗΣ ↔ ΠΡΟΣΦΟΡΑΣ (ADR-846 Φάση 5β) ─────────────────────
  /**
   * 🔴 **Η ΔΗΜΟΣΙΕΥΣΗ ΗΤΑΝ ΣΙΩΠΗΛΑ ΚΑΤΑΣΤΡΟΦΙΚΗ.** Ο επαγγελματίας που δήλωνε
   * εμβέλεια χωρίς τις περιοχές των **ήδη δημοσιευμένων** ακινήτων του
   * εξαφανιζόταν από εκεί όπου αποδεδειγμένα δουλεύει — και **κανείς δεν του το
   * έλεγε**. Αυτά τα κλειδιά είναι το `terraform plan` της δήλωσης: *τι θα
   * αλλάξει, μετρημένο, **πριν** το «Δημοσίευση»*.
   */
  coverageAgreementTitle: `${K}.coverageAgreementTitle`,
  /** ⚠️ **Δύο αριθμοί, ένα plural**: `{count}` τα εκτός, `{total}` τα συνολικά. */
  coverageAgreementOutside: `${K}.coverageAgreementOutside`,
  /** 🔑 *«Οι αγγελίες παραμένουν ορατές»* — η **μη**-συνέπεια λέγεται κι αυτή. */
  coverageAgreementConsequence: `${K}.coverageAgreementConsequence`,
  /** ⚠️ Υποκείμενο **εμείς**: *«δεν ξέρουμε»*, ποτέ *«δεν δήλωσες»*. */
  coverageAgreementUnknown: `${K}.coverageAgreementUnknown`,
  /** Η **μόνη** αυτόματη επιδιόρθωση που είναι υπολογίσιμη: μεγαλύτερο βήμα ακτίνας. */
  coverageAgreementExtendRadius: `${K}.coverageAgreementExtendRadius`,
  /** Όταν δεν υπάρχει υπολογίσιμη πρόταση — **ποτέ** μαντεψιά περιοχής. */
  coverageAgreementNoAutoFix: `${K}.coverageAgreementNoAutoFix`,
  /** Ακτίνα εκτός του κλειστού καταλόγου — δεύτερη ζώνη, η οθόνη δεν την παράγει. */
  coverageRadiusInvalid: `${K}.coverageRadiusInvalid`,
  /** Η ερώτηση του τρόπου δήλωσης: διοικητικές περιοχές, ακτίνα ή χαραγμένο σχήμα; */
  coverageModeAreas: `${K}.coverageModeAreas`,
  coverageModeRadius: `${K}.coverageModeRadius`,
  coverageModeOutline: `${K}.coverageModeOutline`,
  /** Το χαραγμένο πολύγωνο (ADR-846 Φ3). */
  coverageOutlineHint: `${K}.coverageOutlineHint`,
  coverageOutlineMissing: `${K}.coverageOutlineMissing`,
  coverageOutlineExtent: `${K}.coverageOutlineExtent`,
  /** Το χειριστήριο της απόστασης. */
  coverageRadiusLabel: `${K}.coverageRadiusLabel`,
  coverageRadiusOption: `${K}.coverageRadiusOption`,
  /** Το κέντρο: πού πατάει ο κύκλος. */
  coverageCenterHint: `${K}.coverageCenterHint`,
  coverageCenterMissing: `${K}.coverageCenterMissing`,
  coverageCenterUseHome: `${K}.coverageCenterUseHome`,
  coverageCenterSet: `${K}.coverageCenterSet`,
  /**
   * ⚠️ **ΤΑ ΔΥΟ ΤΑΒΑΝΙΑ ΤΟΥ ΠΟΛΥΓΩΝΟΥ ΕΧΟΥΝ ΔΙΚΑ ΤΟΥΣ ΛΟΓΙΑ** — δες
   * {@link COVERAGE_OUTLINE_DEFECT_KEYS}: η θεραπεία τους διαφέρει *(σβήσε κορυφές ·
   * χάραξε μικρότερο)*, και ένα κοινό «άκυρο σχήμα» θα ήταν γρίφος.
   */
  coverageOutlineTooManyVertices: `${K}.coverageOutlineTooManyVertices`,
  coverageOutlineTooWide: `${K}.coverageOutlineTooWide`,
  publish: `${K}.publish`,
  publishing: `${K}.publishing`,
  publishedAt: `${K}.publishedAt`,
  republish: `${K}.republish`,
  withdraw: `${K}.withdraw`,
  withdrawing: `${K}.withdrawing`,
  withdrawHint: `${K}.withdrawHint`,
  statusPublished: `${K}.statusPublished`,
  statusNotPublished: `${K}.statusNotPublished`,
  notAllowed: `${K}.notAllowed`,
  /** Το URI δεν βρέθηκε στην ταξινομία ⇒ *«διάλεξε ξανά»*. */
  occupationUnknown: `${K}.occupationUnknown`,
  /** 🔴 *«Δεν μπορέσαμε να ρωτήσουμε»* ⇒ **ξαναδοκίμασε**, ΠΟΤΕ «διόρθωσε». */
  temporarilyUnavailable: `${K}.temporarilyUnavailable`,
  /** Ο δεσμός δεν δείχνει σε τόπο που υπάρχει. */
  placeNotFound: `${K}.placeNotFound`,
  failed: `${K}.failed`,
} as const;

/**
 * **ΤΟ ΣΗΜΑ** (ADR-841 §7 Α21, Φάση 2) — ξεχωριστός πίνακας, γιατί είναι ξεχωριστή πράξη.
 *
 * 🔑 **Δεν μπήκε στο {@link SHOWCASE_KEYS}** παρότι μοιράζεται πρόθεμα: εκείνος ο πίνακας
 * είναι το λεξιλόγιο της **δήλωσης** — κάθε γραμμή του ταξιδεύει στο ίδιο `publish`. Το
 * σήμα ταξιδεύει **μόνο του**, σε δική του διαδρομή, με δικές του αρνήσεις· ένας κοινός
 * πίνακας θα έκρυβε ακριβώς τη διάκριση που ολόκληρη η Φάση 2 πήγε να κάνει ορατή.
 *
 * ⚠️ **Κυριολεκτικά κλειδιά μέσα από σταθερά module** — ποτέ ``t(`…mark.${state}`)``: το
 * δυναμικό κλειδί είναι **αόρατο στη CHECK 3.8** και **ανεπίλυτο** για τον τεμαχιστή του
 * ADR-744. Το μάθημα είναι ήδη πληρωμένο σε αυτό ακριβώς το αρχείο.
 */
export const SHOWCASE_MARK_KEYS = {
  label: `${K}.mark.label`,
  hint: `${K}.mark.hint`,
  // ── Η ΕΠΙΛΟΓΗ ΕΙΔΟΥΣ ──────────────────────────────────────────────────────
  /** 🔑 *«Τι **δείχνει** η εικόνα;»* — ερώτηση για το **περιεχόμενο**, όχι για το σχήμα.
   *  Ο άνθρωπος ξέρει τι ανέβασε· δεν ξέρει τι είναι το `object-fit`. */
  kindLegend: `${K}.mark.kindLegend`,
  kindLogo: `${K}.mark.kindLogo`,
  kindLogoHint: `${K}.mark.kindLogoHint`,
  kindPortrait: `${K}.mark.kindPortrait`,
  kindPortraitHint: `${K}.mark.kindPortraitHint`,
  // ── ΟΙ ΠΡΑΞΕΙΣ ────────────────────────────────────────────────────────────
  choose: `${K}.mark.choose`,
  replace: `${K}.mark.replace`,
  remove: `${K}.mark.remove`,
  // ── ΟΙ ΚΑΤΑΣΤΑΣΕΙΣ ────────────────────────────────────────────────────────
  /** ⚠️ **Τρεις**, όχι μία: ο άνθρωπος βλέπει τρία διαφορετικά πράγματα να συμβαίνουν. */
  uploading: `${K}.mark.uploading`,
  publishing: `${K}.mark.publishing`,
  removing: `${K}.mark.removing`,
  /** 🔑 *«Δημοσίευσε πρώτα»* — **ρητά**, ποτέ σιωπηλά γκρι κουμπί. */
  needsShowcase: `${K}.mark.needsShowcase`,
  // ── Ο ΚΡΙΤΗΣ — ΕΙΣΟΔΟΥ *(άρνηση)* ΚΑΙ ΕΞΟΔΟΥ *(προειδοποίηση)* ─────────────
  /** ⛔ Κάτω από τη μικρότερη βαθμίδα του ραφιού — **άρνηση**, με **δύο** νούμερα. */
  tooSmall: `${K}.mark.tooSmall`,
  /**
   * 🔴 **ΔΥΟ ΜΗΝΥΜΑΤΑ, ΚΑΙ ΤΟ ΠΛΗΘΟΣ ΤΟΥΣ ΕΙΝΑΙ ΘΕΩΡΗΜΑ — ΟΧΙ ΕΠΙΛΟΓΗ.**
   *
   * Η πρώτη γραφή είχε **δύο**, και διάλεγε με `coversCard ? blurryPage : blurryEverywhere`.
   * Ήταν **ψέμα σε ολόκληρη ζώνη**: για `shortest` ανάμεσα σε **128 και 255** ίσχυαν *και τα
   * δύο* `coversCard` **και** `coversPage`, οπότε η οθόνη ανακοίνωνε *«θολό στη σελίδα»* για
   * εικόνα που τη **σελίδα την καλύπτει μια χαρά**. Η διόρθωση της **Α21.9** πρόσθεσε τρίτο
   * μήνυμα *(`blurryDense`)*.
   *
   * 🔴 **ΚΑΙ ΤΟ ΤΡΙΤΟ ΗΤΑΝ ΑΔΥΝΑΤΟ ΝΑ ΕΜΦΑΝΙΣΤΕΙ ΑΠΟ ΤΗΝ ΠΡΩΤΗ ΜΕΡΑ.** Η ίδια η άγκυρα
   * της Α21.9 το έγραψε — *«οι ζώνες έγιναν δύο, η τρίτη ήταν παραπροϊόν λάθους»* — και
   * **το κλειδί έμεινε**, μαζί με δύο κείμενα σε δύο γλώσσες που **κανείς δεν επρόκειτο
   * να δει ποτέ**. Διαγράφηκε στην **Α21.13**.
   *
   * 🔑 **Και τώρα το πλήθος αποδεικνύεται, δεν παρατηρείται**: η σελίδα είναι μεγαλύτερη
   * από την κάρτα **και στις δύο** πλευρές, σε **κάθε** σχήμα *(τετράγωνο 96×96 ή ζώνη
   * 240×64 έναντι 44×44)* ⇒ `coversPage` **συνεπάγεται** `coversCard` ⇒ ο συνδυασμός
   * *«σελίδα ναι, κάρτα όχι»* δεν υπάρχει, και *«και τα δύο ναι»* **είναι** η αποδοχή.
   * Άρα μένουν ακριβώς **δύο** ζώνες. Άγκυρα το φυλάει.
   *
   * | ζώνη | κάρτα | σελίδα | μήνυμα |
   * |---|---|---|---|
   * | τίποτα δεν καλύπτεται | ✗ | ✗ | {@link blurryEverywhere} |
   * | μόνο η κάρτα | ✓ | ✗ | {@link blurryPage} |
   * | και τα δύο | ✓ | ✓ | **σιωπή** — δεν υπάρχει μήνυμα, γιατί δεν υπάρχει πρόβλημα |
   */
  blurryPage: `${K}.mark.blurryPage`,
  blurryEverywhere: `${K}.mark.blurryEverywhere`,
  unreadable: `${K}.mark.unreadable`,
  uploadFailed: `${K}.mark.uploadFailed`,
  /** 🔑 *«Οι γωνίες δεν θα φαίνονται»* — **πριν** την περικοπή, όχι μετά. */
  cropNote: `${K}.mark.cropNote`,
} as const;

/**
 * 🏆 **ΤΙ ΝΑ ΚΑΝΕΙ Ο ΑΝΘΡΩΠΟΣ ΓΙΑ ΤΟ ΔΗΜΟΣΙΕΥΜΕΝΟ ΣΗΜΑ ΤΟΥ** (ADR-841 §7 Α21.13).
 *
 * 🔴 **ΞΕΧΩΡΙΣΤΟ ΚΛΕΙΔΙ ΑΝΑ ΕΙΔΟΣ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΦΙΛΟΛΟΓΙΑ — ΕΙΝΑΙ ΑΛΗΘΕΙΑ.** Το λογότυπο
 * **τρίβεται** πριν δημοσιευτεί *(Α21.10)*, οπότε η σωστή οδηγία περιλαμβάνει το *«ή με
 * λιγότερο κενό γύρω του»* — και **εξηγεί** γιατί ο αριθμός στην οθόνη δεν είναι αυτός που
 * ανέβασε. Το **πορτρέτο δεν τρίβεται ποτέ**: η ίδια πρόταση εκεί θα ήταν **ψέμα**, και θα
 * έστελνε τον άνθρωπο να κόψει τη φωτογραφία του χωρίς λόγο.
 *
 * 🔑 **Λέει ΤΙ ΝΑ ΚΑΝΕΙ, ποτέ τι έφταιξε.** *«Το τρίμμα μείωσε τις διαστάσεις»* είναι
 * σωστή πρόταση για μηχανικό· ο υδραυλικός δεν ξέρει τι είναι τρίμμα και δεν οφείλει.
 *
 * 🔴 `Record<ShowcaseMarkKind, string>` πάνω στο **κλειστό σύνολο**: τρίτο είδος **δεν
 * μεταγλωττίζεται** μέχρι κάποιος απαντήσει *«τι να κάνει αν βγει θολό;»*.
 */
export const SHOWCASE_MARK_ADVICE_KEYS: Record<ShowcaseMarkKind, string> = {
  logo: `${K}.mark.adviceLogo`,
  portrait: `${K}.mark.advicePortrait`,
};

/**
 * **Κάθε λόγος άρνησης του γραφέα, με το κλειδί του.**
 *
 * 🔴 `Record<…>` πάνω στο **κλειστό σύνολο** — δες το σκεπτικό στην κορυφή.
 */
export const SHOWCASE_REJECTION_KEYS: Record<AgencyProfileRejection, string> = {
  'agency-profile-alias-missing': `${K}.rejection.agency-profile-alias-missing`,
  'agency-profile-name-missing': `${K}.rejection.agency-profile-name-missing`,
  'agency-profile-occupation-missing': `${K}.rejection.agency-profile-occupation-missing`,
  'agency-profile-registration-missing': `${K}.rejection.agency-profile-registration-missing`,
  'agency-profile-chapter-missing': `${K}.rejection.agency-profile-chapter-missing`,
  'agency-profile-mark-not-owned': `${K}.rejection.agency-profile-mark-not-owned`,
  'agency-profile-mark-unknown-kind': `${K}.rejection.agency-profile-mark-unknown-kind`,
  'agency-profile-mark-without-showcase': `${K}.rejection.agency-profile-mark-without-showcase`,
  'agency-profile-mark-unpublishable': `${K}.rejection.agency-profile-mark-unpublishable`,
  'agency-profile-card-without-showcase': `${K}.rejection.agency-profile-card-without-showcase`,
  'agency-profile-card-too-many-locations': `${K}.rejection.agency-profile-card-too-many-locations`,
  'agency-profile-card-two-headquarters': `${K}.rejection.agency-profile-card-two-headquarters`,
  'agency-profile-card-too-many-channels': `${K}.rejection.agency-profile-card-too-many-channels`,
  'agency-profile-card-phone-invalid': `${K}.rejection.agency-profile-card-phone-invalid`,
  'agency-profile-card-email-invalid': `${K}.rejection.agency-profile-card-email-invalid`,
  'agency-profile-card-hours-invalid': `${K}.rejection.agency-profile-card-hours-invalid`,
  'agency-profile-card-street-incomplete': `${K}.rejection.agency-profile-card-street-incomplete`,
};

/**
 * 🏆 **Η ΚΑΡΤΑ** (ADR-841 §7 Α21.16) — ξεχωριστός πίνακας, για τον λόγο του {@link SHOWCASE_MARK_KEYS}:
 * είναι ξεχωριστή πράξη, με δική της διαδρομή (`PUT /api/agency-profile/card`).
 */
export const SHOWCASE_CARD_KEYS = {
  title: `${K}.cardTitle`,
  lead: `${K}.cardLead`,
  needsShowcase: `${K}.cardNeedsShowcase`,
  empty: `${K}.cardEmpty`,
  addHeadquarters: `${K}.cardAddHeadquarters`,
  addBranch: `${K}.cardAddBranch`,
  removeLocation: `${K}.cardRemoveLocation`,
  labelLabel: `${K}.cardLabelLabel`,
  labelPlaceholder: `${K}.cardLabelPlaceholder`,
  placeLabel: `${K}.cardPlaceLabel`,
  placeHint: `${K}.cardPlaceHint`,
  placeMissing: `${K}.cardPlaceMissing`,
  publishStreet: `${K}.cardPublishStreet`,
  publishStreetHint: `${K}.cardPublishStreetHint`,
  streetLabel: `${K}.cardStreetLabel`,
  numberLabel: `${K}.cardNumberLabel`,
  postalCodeLabel: `${K}.cardPostalCodeLabel`,
  phonesLabel: `${K}.cardPhonesLabel`,
  phonePlaceholder: `${K}.cardPhonePlaceholder`,
  extensionPlaceholder: `${K}.cardExtensionPlaceholder`,
  addPhone: `${K}.cardAddPhone`,
  removePhone: `${K}.cardRemovePhone`,
  emailsLabel: `${K}.cardEmailsLabel`,
  emailPlaceholder: `${K}.cardEmailPlaceholder`,
  addEmail: `${K}.cardAddEmail`,
  removeEmail: `${K}.cardRemoveEmail`,
  /** 🔑 Λέει **γιατί** ο αριθμός δεν γράφεται στη σελίδα — αλλιώς μοιάζει με ελάττωμα. */
  channelsHint: `${K}.cardChannelsHint`,
  hoursLabel: `${K}.cardHoursLabel`,
  hoursDeclare: `${K}.cardHoursDeclare`,
  dayClosed: `${K}.cardDayClosed`,
  addInterval: `${K}.cardAddInterval`,
  removeInterval: `${K}.cardRemoveInterval`,
  opensLabel: `${K}.cardOpensLabel`,
  closesLabel: `${K}.cardClosesLabel`,
  save: `${K}.cardSave`,
  saving: `${K}.cardSaving`,
  saved: `${K}.cardSaved`,
  loadFailed: `${K}.cardLoadFailed`,
  // ── Η ΠΟΡΤΑ ΚΑΙ Η ΕΠΙΣΤΡΟΦΗ — η κάρτα ζει σε ΔΙΚΗ ΤΗΣ υποσελίδα (Α21.16.7) ─────────
  door: `${K}.cardDoor`,
  doorHint: `${K}.cardDoorHint`,
  backToShowcase: `${K}.cardBackToShowcase`,
} as const;

/** **Ρόλος καταστήματος → ετικέτα** — `Record` στο κλειστό σύνολο. */
export const SHOWCASE_CARD_ROLE_KEYS: Record<ShowcaseLocationRole, string> = {
  headquarters: `${K}.cardRoleHeadquarters`,
  branch: `${K}.cardRoleBranch`,
};

/**
 * **Ελάττωμα ωραρίου → κλειδί** — ο **ίδιος** κριτής (`weeklyHoursDefect`) που τρέχει ο
 * διακομιστής, λεγμένος **πριν** την υποβολή. Εδώ η ανάδραση, εκεί η εγγύηση.
 */
export const SHOWCASE_CARD_HOURS_DEFECT_KEYS: Record<WeeklyHoursDefect, string> = {
  'time-malformed': `${K}.cardHoursDefect.time-malformed`,
  'interval-empty': `${K}.cardHoursDefect.interval-empty`,
  'intervals-overlap': `${K}.cardHoursDefect.intervals-overlap`,
  'too-many-intervals': `${K}.cardHoursDefect.too-many-intervals`,
};

/**
 * **Ετικέτα και υπόδειξη ανά είδος σήματος** — δύο `Record`, **ένα επίπεδο ο καθένας**.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 Η ΘΕΣΗ ΚΑΙ ΤΟ ΣΧΗΜΑ ΤΟΥΣ ΤΑ ΟΡΙΣΕ Ο ΓΕΝΝΗΤΟΡΑΣ — ΤΡΕΙΣ ΦΟΡΕΣ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Ο τεμαχιστής του ADR-744 *(CHECK 3.34)* αρνήθηκε τη διαδρομή **τρεις** φορές, και κάθε
 * άρνηση δίδαξε έναν κανόνα της σκάλας επίλυσης:
 *
 * | # | τι δοκιμάστηκε | γιατί δεν λύθηκε |
 * |---|---|---|
 * | 1 | πίνακας **μέσα** στη συνάρτηση | τοπική μεταβλητή = τιμή **χρόνου εκτέλεσης** |
 * | 2 | πίνακας σε επίπεδο module, **ένθετος** *(`{label, hint}`)* | η σκάλα λύνει **μία** ευρετηρίαση· το `X[k].field` είναι **δύο** |
 * | 3 | δύο επίπεδοι πίνακες, με τιμές `SHOWCASE_MARK_KEYS.kindLogo` | οι τιμές ήταν **αναφορές** σε άλλη σταθερά — **δεύτερο** επίπεδο έμμεσης |
 *
 * ⇒ **Εδώ, με κυριολεκτικά πρότυπα** — ακριβώς όπως ο γείτονας
 * {@link SHOWCASE_REJECTION_KEYS}, που λύνεται από την πρώτη μέρα. Το `t()` γίνεται
 * `t(SHOWCASE_MARK_KIND_LABEL_KEYS[kind])`: μία ευρετηρίαση, σε σταθερά module, με
 * κυριολεκτική τιμή.
 *
 * ⚠️ **Η θεραπεία ΔΕΝ ήταν `dynamicKeyPolicy`.** Μια δηλωμένη εξαίρεση θα έλυνε τον
 * τεμαχιστή και θα **άφηνε τα κλειδιά αόρατα στη CHECK 3.8** — ακριβώς το λάθος που η
 * κεφαλίδα αυτού του αρχείου απορρίπτει ονομαστικά. Η μετακίνηση τα λύνει **και στα
 * δύο** εργαλεία, χωρίς καμία εξαίρεση πουθενά.
 *
 * 🔑 `Record<ShowcaseMarkKind, string>` πάνω στο κλειστό σύνολο, **και οι δύο**: τρίτο
 * είδος **δεν μεταγλωττίζεται** μέχρι να αποκτήσει ετικέτα **και** υπόδειξη.
 */
export const SHOWCASE_MARK_KIND_LABEL_KEYS: Record<ShowcaseMarkKind, string> = {
  logo: `${K}.mark.kindLogo`,
  portrait: `${K}.mark.kindPortrait`,
};

/**
 * Δες {@link SHOWCASE_MARK_KIND_LABEL_KEYS}.
 *
 * 🔑 **Η υπόδειξη είναι που κάνει την επιλογή** — *«εμφανίζεται σε κύκλο, οι γωνίες δεν
 * φαίνονται»*. Χωρίς αυτήν, τα δύο κουμπιά είναι δύο λέξεις χωρίς συνέπεια.
 */
export const SHOWCASE_MARK_KIND_HINT_KEYS: Record<ShowcaseMarkKind, string> = {
  logo: `${K}.mark.kindLogoHint`,
  portrait: `${K}.mark.kindPortraitHint`,
};

/**
 * **ΚΑΘΕ ΕΛΑΤΤΩΜΑ ΧΑΡΑΓΜΕΝΗΣ ΕΜΒΕΛΕΙΑΣ → ΤΑ ΛΟΓΙΑ ΤΟΥ** *(ADR-846 Φ3)*.
 *
 * 🔑 **`Record<CoverageOutlineDefect, …>` — ΕΞΑΝΤΛΗΤΙΚΟ ΕΠΙΤΗΔΕΣ**: έκτο ελάττωμα
 * **δεν μεταγλωττίζεται** χωρίς κείμενο. Είναι το ίδιο ιδίωμα με το `ZOOM_FOR_STEP`
 * της Φάσης 2 *(«πέμπτο βήμα δεν μεταγλωττίζεται χωρίς ζουμ»)*, εφαρμοσμένο στο i18n.
 *
 * 🏆 **ΤΑ ΠΕΝΤΕ ΤΟΥ ΣΧΗΜΑΤΟΣ ΔΕΙΧΝΟΥΝ ΣΤΑ ΥΠΑΡΧΟΝΤΑ ΚΛΕΙΔΙΑ**, στο `search-results` —
 * τα **ίδια** που λέει ήδη το `OutlineDraftControls` όσο ο άνθρωπος χαράζει. Δεύτερη
 * διατύπωση για το ίδιο πρόβλημα θα ήταν ο άνθρωπος να διαβάζει **άλλα λόγια** πριν και
 * μετά την υποβολή. *(Το `search-results` είναι **εγγυημένο namespace του κελύφους**,
 * άρα τα κλειδιά ταξιδεύουν ήδη — το route slice δεν μεγαλώνει.)*
 *
 * ⚠️ **Μόνο τα ΔΥΟ της εμβέλειας είναι καινούργια** — γιατί μόνο αυτά είναι δικά της.
 */
export const COVERAGE_OUTLINE_DEFECT_KEYS: Record<CoverageOutlineDefect, string> = {
  'coverage-outline-too-many-vertices': SHOWCASE_KEYS.coverageOutlineTooManyVertices,
  'coverage-outline-too-wide': SHOWCASE_KEYS.coverageOutlineTooWide,
  'outline-too-few-vertices': 'search-results:place.defect.outline-too-few-vertices',
  'outline-degenerate': 'search-results:place.defect.outline-degenerate',
  'outline-self-intersecting': 'search-results:place.defect.outline-self-intersecting',
  'outline-outside-served-area': 'search-results:place.defect.outline-outside-served-area',
  'point-off-earth': 'search-results:place.defect.point-off-earth',
};

/** Το δεύτερο namespace που χρειάζεται ο {@link COVERAGE_OUTLINE_DEFECT_KEYS}. */
export const OUTLINE_DEFECT_NS = 'search-results';
