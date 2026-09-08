/**
 * @fileoverview **ΚΩΔΙΚΟΣ → ΚΛΕΙΔΙ ΚΕΙΜΕΝΟΥ** για τον δημόσιο κατάλογο και τη σελίδα προφίλ.
 * @related ADR-827 §9.6 · §9.8 · §9.9 · N.11 · CHECK 3.8
 * @module components/mandate/agency-directory-labels
 *
 * ⚠️ **Ίδιο ιδίωμα με το `agency-showcase-labels.ts`, ξεχωριστό αρχείο — και δεν είναι
 * δίδυμο**: εκείνο ονομάζει τα κλειδιά της οθόνης **του γραφείου** *(«θέλω να με
 * βρίσκουν»)*, αυτό τα κλειδιά των **δημόσιων** οθονών *(«ποιος υπάρχει και πώς του
 * μιλάω»)*. Δύο ακροατήρια, δύο υποδέντρα i18n, μηδέν κοινό κλειδί — μια κοινή
 * σταθερά θα ένωνε τα route slices τους και θα κουβαλούσε το ένα κείμενο στην οθόνη
 * του άλλου *(και τα δύο έχουν μετρημένο budget στο `.i18n-shell-slice.json`)*.
 *
 * ⛔ **ΚΑΝΕΝΑ δυναμικό κλειδί.** Ο τεμαχιστής επιλύει **μόνο** `t(TABLE[x])` με πίνακα
 * σταθερό στο ίδιο module, ή literal — μετρημένο στη (δ): `t(failureKey(f))` και
 * `{...A, ...B}` βγήκαν *«unresolved dynamic t()»*.
 */

import type { CredibilityNote } from '@/lib/professional/professional-credibility';

/** Το namespace — **`property-market`**, το ίδιο με τη βιτρίνα και τις αγγελίες. */
export const AGENCY_PUBLIC_NS = 'property-market';

const D = 'property-market:mandate.directory';
const P = 'property-market:mandate.profile';
const C = 'property-market:mandate.credibility';

/** Ο κατάλογος — `/pro`. */
export const DIRECTORY_KEYS = {
  title: `${D}.title`,
  lead: `${D}.lead`,
  loading: `${D}.loading`,
  empty: `${D}.empty`,
  emptyHint: `${D}.emptyHint`,
  emptyAfterFilter: `${D}.emptyAfterFilter`,
  emptyAfterFilterHint: `${D}.emptyAfterFilterHint`,
  failed: `${D}.failed`,
  count: `${D}.count`,
  countFiltered: `${D}.countFiltered`,
  clearFilters: `${D}.clearFilters`,
  occupationFilterLabel: `${D}.occupationFilterLabel`,
  occupationAll: `${D}.occupationAll`,
  /** Α19 — το πεδίο **πληκτρολογείται**· δες `OccupationSelect`. */
  occupationSearchPlaceholder: `${D}.occupationSearchPlaceholder`,
  /** ⚠️ **«Δεν ταιριάζει με ό,τι έγραψες»**, ΟΧΙ «δεν υπάρχει»: το δεύτερο το λέει το
   *  `occupationScopeHint`, και είναι **άλλη αλήθεια** *(Α4.4-Γ)*. */
  occupationSearchEmpty: `${D}.occupationSearchEmpty`,
  occupationScopeHint: `${D}.occupationScopeHint`,
  placeFilterLabel: `${D}.placeFilterLabel`,
  placeAll: `${D}.placeAll`,
  radiusLabel: `${D}.radiusLabel`,
  /** ⚠️ **Η ΜΟΝΑΔΑ ΖΕΙ ΣΤΟ ΚΕΙΜΕΝΟ** («{km} χλμ»), όχι στον αριθμό: ένας αριθμός
   *  με κρυμμένη μονάδα είναι το σχήμα που ονομάζει το ADR-716. */
  radiusOption: `${D}.radiusOption`,
  // ── Η ΠΕΡΙΟΧΗ ΩΣ ΦΙΛΤΡΟ (ADR-846) ────────────────────────────────────────
  /** ⚠️ **Δήμος/περιφέρεια/κοινότητα** — το πεδίο πληκτρολογείται, δεν επιλέγεται. */
  areaSearchPlaceholder: `${D}.areaSearchPlaceholder`,
  /** ⚠️ **«Δεν ταιριάζει με ό,τι έγραψες»**, ΟΧΙ «δεν υπάρχει» — ίδια διάκριση με το
   *  `occupationSearchEmpty` παραπάνω. */
  areaSearchEmpty: `${D}.areaSearchEmpty`,
  /** 🔑 Η ιεραρχία φορτώνει **τεμπέλικα** (4,1 MB): η αναμονή λέγεται, δεν σιωπά. */
  areaLoading: `${D}.areaLoading`,
  /** 🔑 *«…**δεν αλλάζει τη σειρά τους**»* — το φίλτρο δεν είναι κατάταξη. */
  areaHint: `${D}.areaHint`,
  // ── Η ΚΑΛΥΨΗ ΟΠΩΣ ΤΗ ΒΛΕΠΕΙ Η ΚΑΡΤΑ (ADR-846) ────────────────────────────
  /** 🔑 **ΤΡΕΙΣ ΔΙΑΦΟΡΕΤΙΚΕΣ ΑΛΗΘΕΙΕΣ, ΤΡΙΑ ΚΛΕΙΔΙΑ.** «Ολόκληρη» και «μέρος»
   *  απαντούν στο **ερώτημα του φίλτρου**· το `coverageDeclared*` απαντά *«τι
   *  δήλωσε»* χωρίς να έχει ρωτηθεί περιοχή. Ένα κοινό κλειδί θα έλεγε στον
   *  επισκέπτη ότι απαντήθηκε ερώτηση που **δεν έκανε**. */
  coverageWithin: `${D}.coverageWithin`,
  coverageIntersects: `${D}.coverageIntersects`,
  /**
   * **Η ΤΕΤΑΡΤΗ ΑΠΑΝΤΗΣΗ** *(ADR-846 Φάση 2)* — «δεν ξέρω», και λέγεται.
   *
   * Εμφανίζεται στα **μεικτά** ζεύγη *(δήλωση ακτίνας εναντίον διοικητικού
   * ερωτήματος, και αντίστροφα)* όσο λείπουν τα παράγωγα αποτυπώματα. ⛔ **ΠΟΤΕ**
   * μη το αντικαταστήσεις με το `coverageIntersects` «για να μη φαίνεται κενό»:
   * θα ήταν ισχυρισμός μερικής κάλυψης που **κανείς δεν έκανε**.
   */
  coverageUnknown: `${D}.coverageUnknown`,
  coverageDeclaredNationwide: `${D}.coverageDeclaredNationwide`,
  /** Το `{areas}` έρχεται **ονοματισμένο** από την ιεραρχία — ποτέ ωμά ids. */
  coverageDeclared: `${D}.coverageDeclared`,
  /** **Η ακτίνα με λέξεις** — δες `types/agency-coverage.ts`, σκέλος 2 του σκεπτικού. */
  coverageDeclaredRadius: `${D}.coverageDeclaredRadius`,
  gemi: `${D}.gemi`,
  open: `${D}.open`,
} as const;

// =============================================================================
// Η ΑΞΙΟΠΙΣΤΙΑ — ΚΟΙΝΗ στην κάρτα και στη βιτρίνα (ADR-841 Φ6-Β)
// =============================================================================

/**
 * ⚠️ **Μπαίνει ΕΔΩ και όχι στο `agency-showcase-labels.ts`** — και είναι ο ίδιος
 * λόγος που τα δύο αρχεία είναι χωριστά: η αξιοπιστία είναι **δημόσια ανάγνωση**,
 * και την καταναλώνουν **και οι δύο** δημόσιες οθόνες *(κάρτα καταλόγου + βιτρίνα)*.
 * Η οθόνη **του γραφείου** δεν τη δείχνει ποτέ — εκείνη **ζητά** τον αριθμό.
 */
export const CREDIBILITY_KEYS = {
  occupationLabel: `${C}.occupationLabel`,
  claimNational: `${C}.claim.national`,
  claimChapter: `${C}.claim.chapter`,
  claimDeclared: `${C}.claim.declared`,
  claimVerified: `${C}.claim.verified`,
} as const;

/**
 * 🔑 **Πίνακας σταθερός στο ΙΔΙΟ module** — ο τεμαχιστής του CHECK 3.34 επιλύει
 * `t(TABLE[x])` **μόνο** έτσι. Ένα ``t(`${C}.note.${note.kind}`)`` θα έβγαινε
 * *«unresolved dynamic t()»* και το κλειδί θα ήταν **αόρατο** στο CHECK 3.8.
 *
 * 🔒 Και ο `Record<…>` είναι **ολικός**: ένα **έβδομο** σημείωμα **δεν
 * μεταγλωττίζεται** μέχρι να αποκτήσει κείμενο — ίδιο ιδίωμα με το
 * `REGISTRY_AUTHORITY_PRESENTATION`.
 *
 * ⚠️ **Ο τύπος πιάνει το κλειδί που λείπει· ΔΕΝ πιάνει δύο κλειδιά με το ΙΔΙΟ
 * κείμενο.** Εκείνο το πιάνει μόνο η άγκυρα της οθόνης, που διαβάζει τα
 * **επιλυμένα** κείμενα από το locale JSON.
 */
export const CREDIBILITY_NOTE_KEYS: Record<CredibilityNote['kind'], string> = {
  'registry-exists-undeclared': `${C}.note.registryExistsUndeclared`,
  'registry-absent-by-nature': `${C}.note.registryAbsentByNature`,
  'registry-unexamined': `${C}.note.registryUnexamined`,
  'authority-mismatch': `${C}.note.authorityMismatch`,
  'registry-absent-yet-declared': `${C}.note.registryAbsentYetDeclared`,
  'classification-unreadable': `${C}.note.classificationUnreadable`,
};

/** Η μία βιτρίνα — `/pro/<ψευδώνυμο>`. */
export const PROFILE_KEYS = {
  loading: `${P}.loading`,
  absentTitle: `${P}.absentTitle`,
  absentLead: `${P}.absentLead`,
  absentAction: `${P}.absentAction`,
  failedTitle: `${P}.failedTitle`,
  failedLead: `${P}.failedLead`,
  gemiLabel: `${P}.gemiLabel`,
  gemiHint: `${P}.gemiHint`,
  /** ⚠️ **«Έδρα», όχι «Περιοχή δραστηριότητας»** — δες `coverageLabel` (ADR-846). */
  placeLabel: `${P}.placeLabel`,
  placeUnknown: `${P}.placeUnknown`,
  /**
   * **Η ΔΗΛΩΜΕΝΗ ΕΜΒΕΛΕΙΑ** *(ADR-846)*.
   *
   * 🔴 Το `placeLabel` έλεγε «Περιοχή δραστηριότητας» **δείχνοντας την έδρα** — υπόσχεση
   * που το δεδομένο δεν μπορούσε να τηρήσει. Πλέον οι δύο ερωτήσεις έχουν δύο γραμμές.
   */
  coverageLabel: `${P}.coverageLabel`,
  coverageUnknown: `${P}.coverageUnknown`,
  coverageNationwide: `${P}.coverageNationwide`,
  /**
   * **Η ακτίνα, με λέξεις, ΣΤΗ ΒΙΤΡΙΝΑ** *(ADR-846 Φ2)*.
   *
   * ⚠️ **Χωριστό από το `DIRECTORY_KEYS.coverageDeclaredRadius`**, όπως χωριστά είναι
   * ήδη τα `coverageNationwide` των δύο οθονών: ο **κατάλογος** γράφει «Δηλώνει: …»
   * *(πρόταση μέσα σε κάρτα)*, η **βιτρίνα** γράφει την τιμή ενός `Fact` με δικό του
   * label. Ένα κοινό κλειδί θα ανάγκαζε τη μία από τις δύο να διαβάζεται στραβά.
   */
  coverageRadius: `${P}.coverageRadius`,
  publishedAt: `${P}.publishedAt`,
  requestCta: `${P}.requestCta`,
  requestHint: `${P}.requestHint`,
  noChannel: `${P}.noChannel`,
  // ⚠️ **ΔΥΟ ΚΕΙΜΕΝΑ ΓΙΑ ΤΗΝ ΙΔΙΑ ΑΠΟΥΣΙΑ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ** (ADR-841 §7 Α5): το
  //    «γιατί δεν έχει τηλέφωνο» ισχύει για **κάθε** επαγγελματία, αλλά ο **λόγος**
  //    δεν είναι ο ίδιος. Ο μεσιτικός επικαλείται τη **μεσιτική σύμβαση** — πρόταση
  //    που σε γραφείο φυσικού αερίου είναι απλώς **ψευδής**. Ένα κοινό κείμενο θα
  //    ήταν λάθος στη μία από τις δύο περιπτώσεις, ό,τι κι αν διαλέγαμε.
  noChannelPro: `${P}.noChannelPro`,
  backToDirectory: `${P}.backToDirectory`,
  // ── ADR-841 §7 (Α6) — ΤΙ ΠΟΥΛΑ, ΟΧΙ ΜΟΝΟ ΠΟΙΟΣ ΕΙΝΑΙ ──────────────────────
  //
  // ⚠️ **Το `listingsFailed` ΔΕΝ συγχωνεύεται με το `listingsEmpty`** (N.12): «δεν
  //    μπόρεσα να ρωτήσω» και «δεν έχει αγγελίες» είναι **διαφορετικές αλήθειες** για
  //    τον επισκέπτη — η μία λέει «ξαναδοκίμασε», η άλλη «ρώτα τον απευθείας». Ίδια
  //    διάκριση με τα `absentTitle` ⇄ `failedTitle` δύο γραμμές πιο πάνω.
  listingsTitle: `${P}.listingsTitle`,
  listingsCount: `${P}.listingsCount`,
  listingsLoading: `${P}.listingsLoading`,
  listingsEmpty: `${P}.listingsEmpty`,
  listingsEmptyHint: `${P}.listingsEmptyHint`,
  /** Ίδιος λόγος με το `noChannelPro`: το «ζήτησέ του να αναλάβει» δεν ισχύει εδώ. */
  listingsEmptyHintPro: `${P}.listingsEmptyHintPro`,
  listingsFailed: `${P}.listingsFailed`,
} as const;
