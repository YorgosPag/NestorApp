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
import type { GreekPublicHolidayId } from '@/lib/calendar/greek-public-holidays';
import type { ShowcaseLocationRole } from '@/types/showcase-card';
import type { ShowcaseLegalForm } from '@/types/showcase-legal-identity';

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
  /**
   * 🔑 *«…**δεν αλλάζει τη σειρά τους**»* — το φίλτρο δεν είναι κατάταξη.
   *
   * ⚠️ **ΙΣΧΥΕΙ ΜΟΝΟ ΓΙΑ ΤΟ ΔΙΟΙΚΗΤΙΚΟ ΣΚΕΛΟΣ, ΚΑΙ ΤΟ ΜΕΤΡΗΣΑΜΕ** *(ADR-846 §9 #12)*:
   * το `whereCenter` δίνει κέντρο **μόνο** στον κύκλο ⇒ `orderAgencies` με
   * `from !== null` ⇒ **πρώτα οι πιο κοντινοί**. Το ίδιο κείμενο πάνω σε ερώτημα-κύκλο
   * θα ήταν **ψέμα**, και η ισοπέδωση των τριών καταστάσεων σε δύο το έκρυβε.
   */
  areaHint: `${D}.areaHint`,
  // ── Ο ΚΥΚΛΟΣ ΩΣ ΕΡΩΤΗΜΑ (ADR-846 §9 #12) ─────────────────────────────────
  //
  // 🔑 **ΔΥΟ ΚΛΕΙΔΙΑ ΓΙΑ ΔΥΟ ΑΛΗΘΕΙΕΣ, ΠΟΤΕ ΕΝΑ ΜΕ ΚΕΝΟ `{area}`.** Το «ξέρω πού είναι
  //    το σημείο» και το «δεν ξέρω» είναι **διαφορετικές** πληροφορίες για τον
  //    επισκέπτη — ίδια διάκριση με `coverageProven` ⇄ `coverageProvenOnly`. Ένα κοινό
  //    κλειδί με άδειο `{area}` θα ζωγράφιζε κρεμασμένη στίξη σε κάθε «δεν ξέρω».
  //
  // ⛔ **ΚΑΜΙΑ ΠΤΩΣΗ, ΚΑΝΕΝΑ ΑΡΘΡΟ ΠΡΙΝ ΤΟ `{area}`** — και είναι **μετρημένο**, όχι
  //    προτίμηση: τα ονόματα της ιεραρχίας κουβαλούν **τα ίδια** το είδος τους, σε
  //    **ονομαστική** και σε **τρία γένη** *(«ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ» · «ΠΕΡΙΦΕΡΕΙΑΚΗ
  //    ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ» · «Δημοτική Κοινότητα Κομοτηνής»)*. Ένα «στον {area}» θα
  //    ήταν σωστό στο ένα τρίτο των περιπτώσεων και **αγράμματο στα άλλα δύο**. Η
  //    διατύπωση χρησιμοποιεί **παράθεση** *(«Το σημείο σας: …»)*, που δεν κλίνει.
  /** Ο κύκλος **χωρίς** μετρημένο αγκυροβόλιο — «δεν ξέρω», και λέγεται ουδέτερα. */
  placeCircleHint: `${D}.placeCircleHint`,
  /** Ο κύκλος **με** μετρημένο αγκυροβόλιο *(point-in-shape, ποτέ αντίστροφη γεωκωδικοποίηση)*. */
  placeCircleHintNamed: `${D}.placeCircleHintNamed`,
  /**
   * **ΤΟ ΑΦΑΙΡΟΥΜΕΝΟ ΣΗΜΑΔΙ** — άλλο ακροατήριο από τον υπαινιγμό, άλλο κείμενο.
   *
   * ⚠️ **Χωριστά κλειδιά από τα `placeCircleHint*` επίτηδες**: ο υπαινιγμός απαντά *«τι
   * κάνει αυτό το χειριστήριο;»* κάτω από ένα πεδίο· το σημάδι απαντά *«τι έχω ενεργό;»*
   * πάνω από τα αποτελέσματα, και **πρέπει να χωρά σε μία σειρά**. Ίδια απόφαση με τα
   * `coverageRadius` ⇄ `coverageDeclaredRadius`: δύο θέσεις, δύο διατυπώσεις.
   */
  whereChipCircle: `${D}.whereChipCircle`,
  whereChipCircleNamed: `${D}.whereChipCircleNamed`,
  /** 🔑 **Περιέχει το ΟΡΑΤΟ κείμενο** — WCAG 2.5.3 · δες `components/ui/filter-chip`. */
  whereChipRemove: `${D}.whereChipRemove`,
  /**
   * **Το προσβάσιμο όνομα της περιοχής «τι φιλτράρω τώρα»**.
   *
   * ⚠️ **`aria-label` και όχι ορατή επικεφαλίδα, επίτηδες**: οπτικά η περιοχή είναι
   * αυτονόητη *(σημάδι + αριθμός, ακριβώς πάνω από τη λίστα)*, ενώ ένας αναγνώστης
   * οθόνης που πλοηγείται **ανά ορόσημο** χρειάζεται όνομα για να ξέρει πού μπήκε.
   * Μια ορατή επικεφαλίδα θα πρόσθετε θόρυβο σε **όλους** για να λύσει το πρόβλημα των
   * **λίγων** — η ίδια απόφαση με κάθε `aria-label` της εφαρμογής.
   */
  queryStateLabel: `${D}.queryStateLabel`,
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
  /**
   * 🏆 **ΓΙΑΤΙ ΕΜΦΑΝΙΣΤΗΚΕ ΑΥΤΟ ΤΟ ΓΡΑΦΕΙΟ** *(ADR-846 Φ5δ)* — «Έχει ακίνητο εδώ».
   *
   * 🔑 **Αυτό ακριβώς λείπει από το Zillow.** Εκεί ο μεσίτης εμφανίζεται από **δύο**
   * πηγές *(δήλωση **και** δραστηριότητα)* και ο επισκέπτης **δεν μαθαίνει ποτέ ποια
   * από τις δύο** τον έφερε μπροστά του. Η ένωση χωρίς εξήγηση **είναι** αδιαφάνεια.
   *
   * ⛔ **Ποτέ αριθμός** *(«3 ακίνητα εδώ»)*: το πλήθος αποθέματος είναι **διάνυσμα
   * κατάταξης** — δες `showcase-presence.ts` και το `Α1` του `agency-directory-order`.
   */
  coverageProven: `${D}.coverageProven`,
  /**
   * Η **δεύτερη** διατύπωση: εμφανίζεται **μόνο** με απόδειξη, χωρίς να το δηλώνει.
   *
   * ⚠️ **Χωριστό κλειδί και όχι σύνθεση δύο προτάσεων**: η περίπτωση είναι
   * **πληροφοριακά διαφορετική** για τον επισκέπτη *(«δεν το διαφημίζει, αλλά είναι
   * εδώ»)*, και μια συρραφή θα διαβαζόταν ως **αντίφαση** αντί για διευκρίνιση.
   */
  coverageProvenOnly: `${D}.coverageProvenOnly`,
  coverageDeclaredNationwide: `${D}.coverageDeclaredNationwide`,
  /** Το `{areas}` έρχεται **ονοματισμένο** από την ιεραρχία — ποτέ ωμά ids. */
  coverageDeclared: `${D}.coverageDeclared`,
  /** **Η ακτίνα με λέξεις** — δες `types/agency-coverage.ts`, σκέλος 2 του σκεπτικού. */
  coverageDeclaredRadius: `${D}.coverageDeclaredRadius`,
  /** **Το χαραγμένο σχήμα με λέξεις** (ADR-846 Φ3) — έκταση, όχι «σχήμα». */
  coverageDeclaredOutline: `${D}.coverageDeclaredOutline`,
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

/**
 * ⚖️ **Η νομική μορφή, ολογράφως** (ADR-841 §7 Α23 Φ4 Α2). Ολικός `Record` πάνω στο `ShowcaseLegalForm` ⇒ νέα μορφή στο
 * προφίλ **δεν μεταγλωττίζεται** χωρίς κείμενο. ⚠️ Όχι τα κλειδιά του `accounting-setup` («ΕΠΕ — Εταιρεία Περ. Ευθύνης»):
 * συντομογραφίες φόρμας λογιστηρίου, όχι δημόσια διατύπωση — και θα έφερναν δεύτερο namespace στο slice του `/pro`.
 */
export const LEGAL_FORM_KEYS: Record<ShowcaseLegalForm, string> = {
  sole_proprietor: `${P}.legalForm.sole_proprietor`,
  oe: `${P}.legalForm.oe`,
  epe: `${P}.legalForm.epe`,
  ae: `${P}.legalForm.ae`,
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
  /**
   * ⚠️ **Χωριστό από το `DIRECTORY_KEYS.coverageDeclaredOutline`**, με τον ίδιο λόγο που
   * είναι χωριστά τα `coverageRadius`: ο **κατάλογος** γράφει «Δηλώνει: …» δίπλα σε
   * άλλες κάρτες, η **βιτρίνα** απαντά σε ετικέτα «Περιοχή δραστηριότητας».
   */
  coverageOutline: `${P}.coverageOutline`,
  /**
   * **ΤΟ ΔΕΥΤΕΡΟ ΜΙΣΟ ΤΗΣ ΑΛΗΘΕΙΑΣ** *(ADR-846 Φ5γ)* — «Έχει **επίσης** ακίνητα εκτός
   * αυτής της περιοχής».
   *
   * 🔑 **Χωρίς αριθμό, επίτηδες.** Το `SHOWCASE_KEYS.coverageAgreementOutside` λέει
   * *«6 από τα 7»* στον **ίδιο** τον επαγγελματία, όπου είναι πράξη ελέγχου. Το ίδιο
   * νούμερο **δημόσια** διαβάζεται ως **κατηγορία**, για κάτι που συχνά είναι απολύτως
   * νόμιμο. Δύο ακροατήρια, δύο κείμενα — ποτέ κοινό κλειδί.
   *
   * ⛔ **Και ποτέ ονόματα περιοχών** — αλλά ο λόγος **ΑΛΛΑΞΕ, και η παλιά γραφή είναι
   * πλέον ψευδής**. Έγραφε *«σημείο → `AdminEntity.id` δεν λύνεται (§9 #1)»*· λύνεται
   * από το §9 #13 *(`containingEntityOfPoint`, point-in-shape στα αποτυπώματα)* — ο
   * φραγμός του §9 #1 αφορούσε την **αντίστροφη γεωκωδικοποίηση**, άλλη διαδρομή.
   *
   * 🔑 **Ο σημερινός λόγος είναι ΣΗΜΑΣΙΟΛΟΓΙΚΟΣ, όχι τεχνικός**: εδώ η πρόταση λέει
   * *«έχει **επίσης** ακίνητα **εκτός** αυτής της περιοχής»*. Ονομάζοντας το «εκτός»
   * θα δημοσιεύαμε **χάρτη του αποθέματος τρίτου** χωρίς να το ζητήσει κανείς — και το
   * πλήθος/η γεωγραφία αποθέματος είναι **διάνυσμα κατάταξης** *(NAR $418M, §8.8.8)*.
   * ⇒ Η σιωπή εδώ είναι **επιλογή**, και μένει ακόμη κι όταν η τεχνική της αδυναμία έφυγε.
   */
  coverageAlsoOutside: `${P}.coverageAlsoOutside`,
  publishedAt: `${P}.publishedAt`,
  /**
   * ⚖️ **ADR-841 §7 Α23 Φ4** — «Σύμφωνα με το ΓΕΜΗ η επιχείρηση δεν είναι ενεργή · έλεγχος {date}».
   *
   * 🔑 **ΤΟ ΙΔΙΟ κλειδί με την πόρτα του κατόχου** (`SHOWCASE_REGISTRY_DOOR_KEYS.closed`): κάτοχος και επισκέπτης
   * διαβάζουν **την ίδια πρόταση** — δεν μπορούν να αποκλίνουν (άγκυρα Κ5 στο `agency-showcase-listings.test.tsx`).
   * Η **πηγή ονομάζεται** («σύμφωνα με το ΓΕΜΗ»), ποτέ δική μας κρίση. ⚠️ Κυριολεκτικό — ο τεμαχιστής του ADR-744 το λύνει.
   */
  registryClosed: 'property-market:mandate.showcase.registry.doorClosed',
  // ── ⚖️ ADR-841 §7 Α23 Φ4 Α2 — ΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ (ν. 4919/2022 άρθ. 22 §4 · Π.Δ. 131/2003 άρθ. 4) ─────────
  //
  // 🔑 Μόνο τίτλος, έδρα και ονόματα μορφής είναι νέα· αριθμός και βεβαίωση **επαναχρησιμοποιούν** υπάρχοντα κλειδιά
  // (`CREDIBILITY_KEYS.claimNational` / `.claimDeclared` · `legalVerifiedOn`) — καμία δεύτερη πρόταση για το ίδιο γεγονός.
  legalTitle: `${P}.legalTitle`,
  legalSeat: `${P}.legalSeat`,
  /** Η **ίδια** πρόταση με την υποσελίδα «Στοιχεία ΓΕΜΗ» του κατόχου (Α23.10) — κάτοχος και επισκέπτης δεν αποκλίνουν. */
  legalVerifiedOn: 'property-market:mandate.showcase.registry.verifiedOn',
  requestCta: `${P}.requestCta`,
  requestHint: `${P}.requestHint`,
  // ── ADR-841 §7 Α21.16 — Η ΚΑΡΤΑ (αντικατέστησε τα `noChannel`/`noChannelPro`) ────────
  //
  // 🔴 Τα δύο κείμενα *«δεν δημοσιεύει τηλέφωνο — επίτηδες»* **αφαιρέθηκαν, δεν έμειναν
  //    ψέματα**: η απόφαση αναιρέθηκε (ADR-827 §9.8 τροποποίηση). Η διάκριση μεσίτη/μη-μεσίτη
  //    **επιβιώνει** στο `cardBrokerWritten`, που λέγεται **μόνο** όταν `acceptsMandate`.
  cardTitle: `${P}.cardTitle`,
  cardHeadquarters: `${P}.cardHeadquarters`,
  cardBranch: `${P}.cardBranch`,
  cardAreaOnly: `${P}.cardAreaOnly`,
  cardDirections: `${P}.cardDirections`,
  cardShowPhone: `${P}.cardShowPhone`,
  cardShowEmail: `${P}.cardShowEmail`,
  cardRevealing: `${P}.cardRevealing`,
  /** ⚠️ Τρία κείμενα αποτυχίας, τρεις θεραπείες: ξαναδοκίμασε · περίμενε · δεν υπάρχει πια. */
  cardRevealFailed: `${P}.cardRevealFailed`,
  cardRevealThrottled: `${P}.cardRevealThrottled`,
  cardRevealGone: `${P}.cardRevealGone`,
  /** Α21.18 — **ένα** δημόσιο κλειδί για πριν **και** μετά την «Εμφάνιση» (56 bytes περιθώριο στο slice). */
  cardEmailConfirmedOn: `${P}.cardEmailConfirmedOn`,
  cardHoursTitle: `${P}.cardHoursTitle`,
  cardToday: `${P}.cardToday`,
  cardClosedDay: `${P}.cardClosedDay`,
  cardOpenNow: `${P}.cardOpenNow`,
  /** Α21.16.8 — βάρδια μετά τα μεσάνυχτα: «κλείνει αύριο στις 02:00» (το «αύριο» από το CLDR, όχι κλειδί). */
  cardClosesLater: `${P}.cardClosesLater`,
  /** Α21.16.8 — το «σύντομα» της Google (`SOON_MINUTES`). */
  cardClosesSoon: `${P}.cardClosesSoon`,
  cardOpensSoon: `${P}.cardOpensSoon`,
  /** Α21.16.8 — **ένα** κλειδί για τη γραμμή της ημέρας **και** για το 24/7. */
  cardOpenAllDay: `${P}.cardOpenAllDay`,
  cardOpensToday: `${P}.cardOpensToday`,
  cardOpensLater: `${P}.cardOpensLater`,
  cardClosedWeek: `${P}.cardClosedWeek`,
  /** 🔴 **Όχι «κλειστό»** — αργία σημαίνει *«ίσως διαφέρει»*. */
  cardHoliday: `${P}.cardHoliday`,
  /** Α21.21 — αργία χωρίς δήλωση **πριν** από το επόμενο άνοιγμα: «Δευτέρα: Δευτέρα του Πάσχα — ίσως διαφέρει». */
  cardHolidayAhead: `${P}.cardHolidayAhead`,
  /** Α21.21 — η γραμμή μιας τέτοιας μέρας στον πίνακα των 7 ημερών. */
  cardHolidayRow: `${P}.cardHolidayRow`,
  /** Α21.21 — σημάδι γραμμής όταν ισχύει δηλωμένο ωράριο ημερομηνίας, όχι το εβδομαδιαίο. */
  cardSpecialDay: `${P}.cardSpecialDay`,
  cardBrokerWritten: `${P}.cardBrokerWritten`,
  // ── ADR-841 §7 Α21.17 — ΕΠΑΦΗ ΚΑΙ ΚΟΙΝΟΠΟΙΗΣΗ ────────────────────────────────────────────
  /** 🔑 Μετρά ως εμφάνιση (ίδιο όριο) — γι' αυτό είναι σύνδεσμος λήψης, όχι αυτόματη προσθήκη. */
  cardSaveContact: `${P}.cardSaveContact`,
  shareOpen: `${P}.shareOpen`,
  shareTitle: `${P}.shareTitle`,
  shareLead: `${P}.shareLead`,
  shareQrAlt: `${P}.shareQrAlt`,
  /** ⚠️ Ο σύνδεσμος **λειτουργεί** χωρίς κωδικό — το λέμε, αλλιώς ο διάλογος μοιάζει χαλασμένος. */
  shareQrFailed: `${P}.shareQrFailed`,
  shareCopyLink: `${P}.shareCopyLink`,
  shareLinkCopied: `${P}.shareLinkCopied`,
  shareNative: `${P}.shareNative`,
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
  /** Μη-μεσιτικός επαγγελματίας: το «ζήτησέ του να αναλάβει» δεν ισχύει εδώ. */
  listingsEmptyHintPro: `${P}.listingsEmptyHintPro`,
  listingsFailed: `${P}.listingsFailed`,
} as const;

/**
 * **Αργία → κλειδί ονόματος** (ADR-841 §7 Α21.16). Πίνακας και όχι δυναμικό κλειδί: η
 * CHECK 3.8 διαβάζει **κυριολεκτικά** ορίσματα, και ο τύπος κάνει τη **14η** αργία να μη
 * μεταγλωττίζεται χωρίς όνομα.
 */
export const PROFILE_ROLE_KEYS: Record<ShowcaseLocationRole, string> = {
  headquarters: `${P}.cardHeadquarters`,
  branch: `${P}.cardBranch`,
};

export const PROFILE_HOLIDAY_KEYS: Record<GreekPublicHolidayId, string> = {
  'new-year': `${P}.holiday.new-year`,
  epiphany: `${P}.holiday.epiphany`,
  'clean-monday': `${P}.holiday.clean-monday`,
  'independence-day': `${P}.holiday.independence-day`,
  'good-friday': `${P}.holiday.good-friday`,
  'easter-sunday': `${P}.holiday.easter-sunday`,
  'easter-monday': `${P}.holiday.easter-monday`,
  'labour-day': `${P}.holiday.labour-day`,
  'whit-monday': `${P}.holiday.whit-monday`,
  assumption: `${P}.holiday.assumption`,
  'ochi-day': `${P}.holiday.ochi-day`,
  christmas: `${P}.holiday.christmas`,
  'boxing-day': `${P}.holiday.boxing-day`,
};
