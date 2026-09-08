/**
 * @fileoverview **ΤΑ ΤΑΒΑΝΙΑ ΤΟΥ ΧΑΡΑΓΜΕΝΟΥ ΠΟΛΥΓΩΝΟΥ** — μία συνάρτηση, τρία σύνορα.
 * @related ADR-846 Φάση 3 · types/agency-coverage.ts · lib/places/place-claim-validation
 * @module lib/agency/coverage-outline
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΕΝΑ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΤΡΕΙΣ ΕΛΕΓΧΟΙ ΣΕ ΤΡΙΑ ΣΗΜΕΙΑ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Το ταβάνι της **ακτίνας** επιβάλλεται σε **δύο** σημεία — γραφέας *(`resolveCoverage`)*
 * και αναγνώστης *(`readCoverageCircle`)* — μέσω **μίας** συνάρτησης
 * *(`asCoverageRadiusKm`)*, με ρητό σκεπτικό: *«ένα `STEPS.includes(x)` σκορπισμένο
 * στον γραφέα και στον αναγνώστη είναι δύο τόποι που μπορούν να αποκλίνουν»*.
 *
 * Το πολύγωνο έχει **τρία** σημεία *(γραφέας · αναγνώστης · **η φόρμα**)* και **πέντε**
 * ερωτήσεις. Άρα ο ίδιος κανόνας, πιο επιτακτικά: **μία** συνάρτηση, τρεις καλούντες.
 *
 * 🔑 **Η φόρμα καλεί την ΙΔΙΑ συνάρτηση με τον διακομιστή** — αλλιώς ο άνθρωπος βλέπει
 * πράσινο, πατά «Ενημέρωση βιτρίνας» και τρώει άρνηση για σχήμα που η οθόνη είχε
 * **δεχτεί**. Είναι ο κανόνας που το `outline-draft.tsx` γράφει ήδη για τα όρια
 * δακτυλίου· εδώ επεκτείνεται στα όρια **εμβέλειας**.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 Η ΣΕΙΡΑ ΤΩΝ ΕΛΕΓΧΩΝ ΕΙΝΑΙ **ΦΡΟΥΡΟΣ ΠΟΡΟΥ**, ΟΧΙ ΓΟΥΣΤΟ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Το **πλήθος κορυφών ελέγχεται ΠΡΩΤΟ**, πριν από κάθε γεωμετρία. Ο έλεγχος αυτοτομής
 * *(`isSimpleGeoOutline`)* συγκρίνει **κάθε ακμή με κάθε ακμή**: είναι **O(n²)**. Ένα
 * σώμα με 10.000 κορυφές θα ζητούσε **50 εκατομμύρια** συγκρίσεις τμημάτων **πριν**
 * απορριφθεί — δηλαδή η ίδια η επικύρωση θα ήταν το φορτίο.
 *
 * ⚠️ Το `place-claim-validation.outlineDefect` βάζει το πλήθος πρώτο για **άλλο** λόγο
 * *(«με δύο σημεία, εμβαδόν και αυτοτομή δεν έχουν καν νόημα»)* και ελέγχει μόνο το
 * **κάτω** όριο. Το **άνω** όριο δεν του ανήκει: εκεί το σχήμα είναι **ένα κτίριο**, εδώ
 * είναι **δήλωση προς το κοινό** που ταξιδεύει σε κάθε ανώνυμο επισκέπτη.
 */

import { ringsFootprint } from '@/lib/geo/geo-footprint';
import { areaSqmToKm2, geoOutlineAreaSqm } from '@/lib/geo/geo-ring';
import { outlineDefect, type OutlineDefect } from '@/lib/places/place-claim-validation';
import { COVERAGE_MAX_OUTER_KM, COVERAGE_MAX_VERTICES } from '@/types/agency-coverage';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';

/**
 * **Τα δύο ελαττώματα που ΜΟΝΟ η εμβέλεια έχει** — τα υπόλοιπα είναι ελαττώματα
 * **σχήματος** και ζουν στο {@link OutlineDefect}, όπου τα βρίσκει και η χάραξη τόπου.
 *
 * 🔑 **Ονομάζονται, δεν αριθμούνται**: *«έχει πάρα πολλές κορυφές»* είναι οδηγία,
 * *«άκυρο σχήμα»* είναι γρίφος — ο ίδιος κανόνας που γράφει το `PLACE_CLAIM_DEFECTS`.
 */
export const COVERAGE_OUTLINE_DEFECTS = [
  /** Πάνω από {@link COVERAGE_MAX_VERTICES} — χάραξη ανθρώπου δεν φτάνει εκεί. */
  'coverage-outline-too-many-vertices',
  /** Ο περιγεγραμμένος κύκλος ξεπερνά το {@link COVERAGE_MAX_OUTER_KM}. */
  'coverage-outline-too-wide',
] as const;

/**
 * ⚠️ **{@link OutlineDefect}, ΟΧΙ `PlaceClaimDefect`** — και η στένωση είναι απόφαση:
 * ένα χαραγμένο περίγραμμα **δεν μπορεί** να είναι `query-empty` ούτε
 * `point-outside-served-area` *(εκείνα αφορούν αναζήτηση και μεμονωμένο σημείο)*. Με
 * τον ευρύ τύπο, ο πίνακας μηνυμάτων της οθόνης θα ζητούσε **δύο κείμενα που δεν
 * εμφανίζονται ποτέ** — δηλαδή i18n χρέος που μοιάζει με κάλυψη.
 */
export type CoverageOutlineDefect = (typeof COVERAGE_OUTLINE_DEFECTS)[number] | OutlineDefect;

/**
 * **Γιατί αυτό το χαραγμένο σχήμα δεν επιτρέπεται ως δήλωση εμβέλειας.** `null` = επιτρέπεται.
 *
 * ⚠️ **Επιστρέφει ΤΟ ΠΡΩΤΟ ελάττωμα**, όπως και ο αδελφός του στη χάραξη τόπου: ο
 * άνθρωπος διορθώνει ένα πράγμα τη φορά, και μια λίστα θα του έλεγε ότι τα έκανε όλα λάθος.
 */
export function coverageOutlineDefect(outline: GeoOutline): CoverageOutlineDefect | null {
  // 1️⃣ ΠΛΗΘΟΣ — φρουρός πόρου, πριν από κάθε O(n²). Δες την επικεφαλίδα.
  if (outline.length > COVERAGE_MAX_VERTICES) return 'coverage-outline-too-many-vertices';

  // 2️⃣ ΕΙΝΑΙ ΣΧΗΜΑ; — ο **ίδιος** κριτής με τη χάραξη τόπου: ≥3 κορυφές, πάνω στη γη,
  //    μέσα στη χώρα, μη εκφυλισμένο, χωρίς αυτοτομή. Καμία δεύτερη γραφή.
  const shape = outlineDefect(outline);
  if (shape !== null) return shape;

  // 3️⃣ ΤΟ ΤΑΒΑΝΙ ΕΚΤΑΣΗΣ — και είναι **ο ίδιος υπολογισμός** που θα κάνει ο κριτής.
  //    ⚠️ `null` εδώ είναι αδύνατο μετά το βήμα 2· η καθαρή συνάρτηση δεν υποθέτει
  //    ότι κάποιος άλλος κοίταξε.
  const footprint = ringsFootprint([outline]);
  if (footprint === null) return 'outline-too-few-vertices';
  if (footprint.outerKm > COVERAGE_MAX_OUTER_KM) return 'coverage-outline-too-wide';

  return null;
}

/** Ένα σημείο, όπως έρχεται από **σώμα αιτήματος ή από τον δίσκο** — ή `null`. */
function asGeoPoint(raw: unknown): GeoPoint | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const { lat, lng } = source;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}

/**
 * **ΤΟ ΣΥΝΟΡΟ ΕΙΣΟΔΟΥ** — ωμό `unknown` → έγκυρο περίγραμμα εμβέλειας, ή `null`.
 *
 * ⚠️ **Ο ΤΥΠΟΣ ΔΕΝ ΕΠΙΒΙΩΝΕΙ ΕΝΟΣ `JSON.parse`** — η ίδια πρόταση που δικαιολογεί το
 * {@link asCoverageRadiusKm}, με **μεγαλύτερο** διακύβευμα: ένα χειρόγραφο πολύγωνο
 * 300 χλμ στη βάση θα ανάσταινε την απαγόρευση #6 από την πίσω πόρτα, παρακάμπτοντας
 * **και** τον τύπο **και** τον γραφέα. Γι' αυτό ο **αναγνώστης** καλεί το ίδιο πράγμα.
 *
 * 🔑 **Ξαναχτίζεται από τα επαληθευμένα μέρη** *(`{ lat, lng }`, τίποτα άλλο)* — ό,τι
 * δεν ελέγχθηκε δεν ταξιδεύει, ίδιο ιδίωμα με τον κύκλο στον `resolveCoverage`.
 */
export function asCoverageOutline(raw: unknown): GeoOutline | null {
  if (!Array.isArray(raw)) return null;
  // 🔑 **Πριν φτιαχτεί ο πίνακας**: ένα σώμα με 100.000 στοιχεία δεν αξίζει ούτε ένα
  //    `map`. Ο ίδιος έλεγχος ξαναγίνεται παρακάτω πάνω στο σχήμα — εδώ είναι **φρένο**.
  if (raw.length > COVERAGE_MAX_VERTICES) return null;

  const vertices: GeoPoint[] = [];
  for (const item of raw) {
    const point = asGeoPoint(item);
    if (point === null) return null;
    vertices.push(point);
  }

  return coverageOutlineDefect(vertices) === null ? vertices : null;
}

/**
 * **ΠΟΣΟ ΜΕΓΑΛΗ ΕΙΝΑΙ Η ΧΑΡΑΓΜΕΝΗ ΠΕΡΙΟΧΗ**, σε τετραγωνικά χιλιόμετρα.
 *
 * 🔑 **Ζει εδώ και όχι στις οθόνες, επειδή οι οθόνες είναι ΔΥΟ** *(κατάλογος και
 * βιτρίνα — §6.4 του handoff: η δεύτερη ξεχάστηκε μία φορά και **έριξε τη δημόσια
 * σελίδα**)*. Δύο `Math.round(sqm / 1e6)` σε δύο αρχεία θα ήταν δίδυμο που αποκλίνει
 * στην πρώτη αλλαγή στρογγυλοποίησης — και ο επισκέπτης θα έβλεπε **άλλο νούμερο** στην
 * κάρτα και άλλο στη βιτρίνα, για το ίδιο σχήμα.
 *
 * ⚠️ **Η στρογγυλοποίηση ΔΕΝ γράφεται εδώ** — ζει στο {@link areaSqmToKm2}, μαζί με το
 * κατώφλι που χρησιμοποιεί και το χειριστήριο χάραξης. Αυτή η συνάρτηση υπάρχει για να
 * μη γράψουν οι **δύο** οθόνες τη σύνθεση `areaSqmToKm2(geoOutlineAreaSqm(…))` χωριστά.
 */
export function coverageOutlineAreaKm2(outline: GeoOutline): number {
  return areaSqmToKm2(geoOutlineAreaSqm(outline));
}
