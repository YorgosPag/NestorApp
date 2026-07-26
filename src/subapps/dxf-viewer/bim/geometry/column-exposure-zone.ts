/**
 * Ζώνη έκθεσης κολώνας — «πού σταματά η όψη και πού αρχίζει το χώμα» (ADR-713, SSoT).
 *
 * Το ADR-712 έδωσε στην επιμέτρηση το **ογκομετρικό** όριο: η κολώνα κατεβαίνει ως την άνω
 * παρειά του πεδίλου (`baseDropMm`, ADR-489 §6.1) και το τμήμα κάτω από τη nominal βάση
 * χρεώνεται χωριστά (OIK-2.07). Αυτό ΔΕΝ είναι το όριο της **όψης**: το τμήμα που είναι
 * μπαζωμένο μέσα στο έδαφος δεν επενδύεται με τούβλο και δεν σοβατίζεται — στεγανώνεται.
 *
 *   ┌──────────────── z_top
 *   │  ΕΚΤΕΘΕΙΜΕΝΗ ΖΩΝΗ  → faceAppearance (επένδυση) + σοβάς (ADR-449)
 *   ├──────────────── z_grade   ← ΤΟ ΟΡΙΟ ΠΟΥ ΟΡΙΖΕΙ ΑΥΤΟ ΤΟ MODULE
 *   │  ΘΑΜΜΕΝΗ ΖΩΝΗ      → στεγανωτική επάλειψη· ΠΟΤΕ επένδυση, ΠΟΤΕ σοβάς
 *   └──────────────── z_buriedBottom == z_footingTop  (== το όριο όγκου του ADR-712)
 *
 * Τα δύο όρια **δένουν** χωρίς να μετακινεί το ένα το άλλο: το κάτω άκρο της θαμμένης ζώνης
 * ΕΙΝΑΙ το ογκομετρικό όριο του ADR-712· το πάνω άκρο της είναι η στάθμη εδάφους.
 *
 * ### Ο cascade της στάθμης εδάφους (απόφαση Giorgio 2026-07-26)
 *
 *   1. **Τοπογραφικό** — δειγματοληψία της μελετημένης επιφάνειας στη θέση της κολώνας
 *      (`terrainGradeAbsMm`). Ακριβές σε επικλινές οικόπεδο: η ανάντη κολώνα θάβεται
 *      περισσότερο από την κατάντη, **αυτόματα**.
 *   2. **Σταθερά κτιρίου** — `gradeDropBelowBaseMm` (πόσο κάτω από το FFL είναι το έδαφος).
 *   3. **FFL** — default `0`, δηλαδή έδαφος στη nominal βάση. Συμφωνεί με το υπάρχον SSoT
 *      §6.2 (`FOUNDATION_SOIL_COVER_MM`: τόσο χώμα μένει πάνω από τα στοιχεία θεμελίωσης
 *      ώστε να μην εξέχουν στη στάθμη) και δίνει θαμμένη ζώνη **ταυτόσημη με το κοντόστυλο
 *      του ADR-712** — άρα μηδενική οπτική μεταβολή πάνω από το FFL σε υπάρχοντα έργα.
 *
 * Το module είναι **pure**: τον cascade τον τροφοδοτεί ο caller (η δειγματοληψία TIN ζει στο
 * `systems/topography/grade-at-plan-point.ts`, ίδιο pure/impure split με το `vertical-datum.ts`).
 *
 * ### Γιατί η στάθμη επιτρέπεται να είναι ΠΑΝΩ από τη nominal βάση
 * Κτίριο σκαμμένο σε πλαγιά: το έδαφος στην ανάντη πλευρά ανεβαίνει πάνω από το FFL, οπότε
 * θάβεται και τμήμα της **ανωδομής**. Ο clamp είναι `[buriedBottom, top]`, όχι
 * `[buriedBottom, nominalBase]`, ακριβώς για να το επιτρέψει. Το Revit απαιτεί χειροκίνητο
 * Split Face για αυτό· εδώ προκύπτει μόνο του από τη γεωμετρία του εδάφους.
 *
 * @see column-foundation-stub.ts — το ΟΓΚΟΜΕΤΡΙΚΟ όριο (ADR-712), αδελφό αλλά ΔΙΑΦΟΡΕΤΙΚΟ
 * @see ../../systems/topography/grade-at-plan-point.ts — ο impure tier-1 του cascade
 * @see docs/centralized-systems/reference/adrs/ADR-713-buried-column-segment-exposure-zone.md
 */

/**
 * mm — πόσο κάτω από τη nominal βάση κάθεται η στάθμη τελειωμένου εδάφους όταν δεν υπάρχει
 * τοπογραφικό ούτε ρύθμιση κτιρίου. **0 = έδαφος στο FFL** (απόφαση Giorgio 2026-07-26):
 * συμφωνεί με το §6.2 και κρατά τα υπάρχοντα έργα οπτικά αμετάβλητα πάνω από το FFL.
 */
export const DEFAULT_GRADE_DROP_BELOW_BASE_MM = 0;

/**
 * mm — κάτω από αυτό, μια ζώνη θεωρείται ανύπαρκτη. Αποτρέπει sliver ζώνες (μηδενικού
 * πάχους material groups / BOQ γραμμές των 0.0001 m²) από αριθμητικό θόρυβο. Ίδια τάξη
 * μεγέθους με το `MIN_BAND_MM` του σοβά.
 */
export const MIN_EXPOSURE_ZONE_MM = 1;

/** Είσοδος του cascade — «σε ποια στάθμη είναι το έδαφος για αυτό το στοιχείο;». */
export interface ExposureGradeInput {
  /** Η nominal βάση της κολώνας — `floorElevationMm + params.baseOffset` (απόλυτα mm). */
  readonly nominalBaseAbsMm: number;
  /** Tier 2 — σταθερά κτιρίου (mm). Απόν → {@link DEFAULT_GRADE_DROP_BELOW_BASE_MM}. */
  readonly gradeDropBelowBaseMm?: number;
  /** Tier 1 — δειγματοληψία τοπογραφικού (ίδιο datum). `null`/απόν → πέφτει στο tier 2. */
  readonly terrainGradeAbsMm?: number | null;
}

/** Είσοδος: όλα σε **απόλυτα mm** στο ίδιο datum (building-relative, όπως ο 3Δ πυρήνας). */
export interface ColumnExposureInput {
  /** Η nominal βάση της κολώνας — `floorElevationMm + params.baseOffset`. */
  readonly nominalBaseAbsMm: number;
  /** Η κορυφή της κολώνας (μετά από κάθε top clip/profile). */
  readonly topAbsMm: number;
  /** ADR-489 §6.1 — προέκταση προς τα κάτω ως την άνω παρειά του πεδίλου. 0 → καμία έδραση. */
  readonly baseDropMm: number;
  /**
   * Η **ήδη λυμένη** στάθμη εδάφους (απόλυτα mm) από τον {@link resolveExposureGradeAbsMm}.
   * Απόν → nominal βάση (default: έδαφος στο FFL).
   */
  readonly gradeAbsMm?: number;
}

/** Ο διαχωρισμός της κολώνας στις δύο ζώνες. Όλα σε απόλυτα mm / mm ύψους. */
export interface ColumnExposureZones {
  /** Η στάθμη τελειωμένου εδάφους, **clamped** στο [buriedBottom, top]. */
  readonly gradeAbsMm: number;
  /** Το κάτω άκρο της θαμμένης ζώνης = άνω παρειά πεδίλου (== όριο όγκου ADR-712). */
  readonly buriedBottomAbsMm: number;
  /** Ύψος θαμμένης ζώνης (mm). 0 → η κολώνα είναι εξ ολοκλήρου εκτεθειμένη. */
  readonly buriedHeightMm: number;
  /** Ύψος εκτεθειμένης ζώνης (mm) — εδώ ισχύουν επένδυση + σοβάς. */
  readonly exposedHeightMm: number;
}

/** Πεπερασμένος αριθμός ή το fallback (αμυντικό — degenerate γεωμετρία/λείπον store). */
function finiteOr(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * **Ο cascade**: σε ποια απόλυτη στάθμη (mm) βρίσκεται το τελειωμένο έδαφος για αυτό το
 * στοιχείο. Τοπογραφικό → σταθερά κτιρίου → FFL. ΧΩΡΙΣ clamp — το στερεό δεν είναι γνωστό
 * εδώ· τον clamp τον κάνει ο {@link resolveColumnExposureZones}.
 *
 * Χωριστή από τον διαχωρισμό ζωνών επειδή απαντά **άλλη ερώτηση** και έχει **άλλο πελάτη**:
 * ο cascade τρέχει ΜΙΑ φορά ανά κολώνα στο sync (χτίζοντας τον κοινό χάρτη που μοιράζονται
 * πυρήνας + σοβάς), ενώ ο διαχωρισμός ζωνών τρέχει σε κάθε καταναλωτή με τη δική του
 * ακριβή γεωμετρία. Ενωμένες, ο ένας θα ξανα-δειγματολήπτιζε το έδαφος του άλλου.
 */
export function resolveExposureGradeAbsMm(input: ExposureGradeInput): number {
  const nominalBaseAbsMm = finiteOr(input.nominalBaseAbsMm, 0);
  const gradeDropMm = Math.max(0, finiteOr(input.gradeDropBelowBaseMm, DEFAULT_GRADE_DROP_BELOW_BASE_MM));
  return finiteOr(input.terrainGradeAbsMm, nominalBaseAbsMm - gradeDropMm);
}

/**
 * Ο διαχωρισμός εκτεθειμένης/θαμμένης ζώνης μιας κολώνας.
 *
 * **Fail-safe by design:** κάθε μη-πεπερασμένη είσοδος πέφτει στο default — δηλαδή στάθμη
 * εδάφους = nominal βάση, που δίνει θαμμένη ζώνη ίση με το κοντόστυλο του ADR-712. Αυτό
 * είναι ταυτόχρονα η ασφαλής οπτική συμπεριφορά (καμία επένδυση κάτω από το FFL) ΚΑΙ η
 * ποσότητα που το ADR-712 ήδη χρεώνει ως σκυρόδεμα θεμελίων — οι δύο μηχανισμοί δεν
 * μπορούν να αποκλίνουν στο degenerate μονοπάτι.
 *
 * `baseDropMm = 0` **και** στάθμη στη βάση → `buriedHeightMm = 0` → ο caller παίρνει το
 * legacy μονοπάτι byte-for-byte (κολώνες ορόφων: μηδέν επίδραση).
 */
export function resolveColumnExposureZones(input: ColumnExposureInput): ColumnExposureZones {
  const nominalBaseAbsMm = finiteOr(input.nominalBaseAbsMm, 0);
  const topAbsMm = finiteOr(input.topAbsMm, nominalBaseAbsMm);
  // Ίδιο clamp με τον 3Δ πυρήνα ΚΑΙ με το `computeColumnFoundationStub` — πέδιλο ψηλότερα
  // από τη βάση δεν «αφαιρεί» κολώνα.
  const dropMm = Math.max(0, finiteOr(input.baseDropMm, 0));
  const buriedBottomAbsMm = nominalBaseAbsMm - dropMm;

  // Απόν/degenerate στάθμη → nominal βάση (default: έδαφος στο FFL) — ΠΟΤΕ NaN προς τα κάτω.
  const rawGradeAbsMm = finiteOr(input.gradeAbsMm, nominalBaseAbsMm);

  // Η ζώνη δεν μπορεί να ξεπεράσει το ίδιο το στερεό: ούτε κάτω από το πέδιλο, ούτε πάνω
  // από την κορυφή. `Math.max(buriedBottom, top)` προστατεύει από εκφυλισμένη κολώνα
  // (top < base), όπου το εύρος του clamp θα ήταν ανάποδο.
  const ceilingAbsMm = Math.max(buriedBottomAbsMm, topAbsMm);
  const gradeAbsMm = Math.min(ceilingAbsMm, Math.max(buriedBottomAbsMm, rawGradeAbsMm));

  const rawBuriedMm = gradeAbsMm - buriedBottomAbsMm;
  const buriedHeightMm = rawBuriedMm >= MIN_EXPOSURE_ZONE_MM ? rawBuriedMm : 0;
  // Το εκτεθειμένο ύψος μετριέται από την **πραγματική** στάθμη κοπής: όταν η θαμμένη ζώνη
  // απορρίπτεται ως sliver, η κοπή επιστρέφει στο κάτω άκρο ώστε τα δύο ύψη να αθροίζουν
  // πάντα στο συνολικό στερεό (καμία χαμένη λωρίδα).
  const cutAbsMm = buriedHeightMm > 0 ? gradeAbsMm : buriedBottomAbsMm;
  const exposedHeightMm = Math.max(0, ceilingAbsMm - cutAbsMm);

  return { gradeAbsMm, buriedBottomAbsMm, buriedHeightMm, exposedHeightMm };
}

/** True όταν η κολώνα έχει πραγματικό θαμμένο τμήμα (→ στεγάνωση + κομμένη επένδυση). */
export function hasBuriedZone(zones: ColumnExposureZones | undefined): zones is ColumnExposureZones {
  return !!zones && zones.buriedHeightMm > 0;
}
