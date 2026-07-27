/**
 * ADR-716 Φ1 — γεωδαιτικό ΠΑΡΑΘΥΡΟ: ταυτοποίηση μονάδας από τη ΘΕΣΗ, όχι από το ΜΕΓΕΘΟΣ.
 *
 * Η ευρετική διαγωνίου ρωτά «πόσο μεγάλο είναι το σχέδιο;» — ερώτημα **μαθηματικά διφορούμενο**:
 * «μεγάλο σχέδιο σε μικρή μονάδα» και «μικρό σχέδιο σε μεγάλη μονάδα» δίνουν την ΙΔΙΑ αριθμητική
 * διαγώνιο, άρα κανένα κατώφλι δεν τα διαχωρίζει (ADR-716 §2). Ένα γεωαναφερμένο ελληνικό
 * τοπογραφικό όμως κουβαλά **δεύτερη, ανεξάρτητη** πληροφορία: κάθεται σε συντεταγμένες
 * προβολικού πλέγματος. Για κάθε υποψήφια μονάδα μετατρέπουμε το extent σε μέτρα και ρωτάμε:
 * **πέφτει μέσα στο ελληνικό προβολικό παράθυρο;**
 *
 * ## Γιατί είναι ΤΑΥΤΟΠΟΙΗΣΗ και όχι ευρετική (ADR-716 §5.4)
 *
 * Το πολύ ΜΙΑ υποψήφια μονάδα μπορεί να περάσει την πύλη Northing. Απόδειξη: αν δύο μονάδες
 * `u₁ < u₂` περνούν αμφότερες, ο ίδιος ωμός αριθμός `y` ικανοποιεί `N_min ≤ y·u₁` και
 * `y·u₂ ≤ N_max`, άρα `u₂/u₁ ≤ N_max/N_min ≈ 1,21`. Ο μικρότερος λόγος μεταξύ δύο μονάδων
 * του `{mm, cm, in, ft, m}` είναι `in/cm = 2,54 > 1,21`. Άτοπο. ∎
 *
 * Ο λόγος 1,21 είναι **γεωγραφικό γεγονός** (η Ελλάδα εκτείνεται σε 7,3° πλάτους), όχι ρύθμιση —
 * γι' αυτό το αποτέλεσμα επιτρέπεται να νικά ακόμη και το `$INSUNITS`. Η απόδειξη είναι
 * εκτελέσιμη: `__tests__/projected-crs-envelopes.test.ts` κοκκινίζει αν κάποιος διευρύνει το
 * παράθυρο τόσο ώστε ο λόγος να ξεπεράσει το 2,54.
 *
 * ## Τι ΔΕΝ κάνει
 *
 * **Δεν ταυτοποιεί CRS — ταυτοποιεί ΜΟΝΑΔΑ.** Δεν μας ενδιαφέρει αν το αρχείο είναι ΕΓΣΑ87 ή
 * UTM 34N/35N· μας ενδιαφέρει ότι οι αριθμοί **είναι μέτρα**. Αυτή η απλοποίηση επιτρέπει ΕΝΑ
 * παράθυρο και για τα τρία CRS: το Northing του UTM στα ελληνικά πλάτη είναι ταυτόσημο (ίδιο
 * k₀ ≈ 1, ίδιο γεωδαιτικό πλάτος) και το Easting του UTM για ελληνικά μήκη πέφτει σε
 * ≈ [378k, 620k] ⊂ [το παράθυρο] (ADR-716 §5.3).
 *
 * Το module είναι **καθαρή συνάρτηση**: μηδέν state, μηδέν εξάρτηση από `utils/` (καμία
 * ανάστροφη ακμή — το λεξιλόγιο μονάδων το δίνει ο καλών), μία μόνο εισαγωγή της **υπάρχουσας**
 * προβολής. Καμία δεύτερη υλοποίηση ΕΓΣΑ87, κανένα `proj4`, κανένας μαγικός αριθμός.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-716-geodetic-unit-identification-dxf-import.md §5
 * @see ./egsa87-projection — ADR-656 M12, η ΜΟΝΗ προβολή του έργου
 */
import { geographicToGrid } from './egsa87-projection';

/** Άξονο-ευθυγραμμισμένο παράθυρο σε προβολικά μέτρα. */
export interface ProjectedEnvelope {
  readonly minE: number;
  readonly maxE: number;
  readonly minN: number;
  readonly maxN: number;
}

/** Άξονο-ευθυγραμμισμένο XY extent σε ΩΜΕΣ (αδιάγνωστες) μονάδες αρχείου. */
export interface RawExtent {
  readonly min: { readonly x: number; readonly y: number };
  readonly max: { readonly x: number; readonly y: number };
}

/**
 * Μία υποψήφια ερμηνεία των ωμών αριθμών. Ο καλών (`utils/scene-units`) παράγει τον πίνακα από
 * τη δική του SSoT μετατροπής — έτσι το «πόσο αξίζει ένα χιλιοστό» ορίζεται σε ΕΝΑ σημείο και
 * αυτό το module μένει ελεύθερο από λεξιλόγιο μονάδων (και από ακμή προς το `utils/`).
 */
export interface GeodeticUnitCandidate<TUnit extends string> {
  readonly unit: TUnit;
  readonly metresPerUnit: number;
}

/**
 * Γεωγραφικό bbox της Ελλάδας — **η ΜΟΝΗ πηγή αλήθειας** του παραθύρου. Καλύπτει με περιθώριο
 * την επικράτεια (Γαύδος ≈ 34,8° N έως Ορμένιο ≈ 41,75° N· Οθωνοί ≈ 19,4° E έως Καστελλόριζο
 * ≈ 29,6° E — το τελευταίο πέφτει έξω από το 28,5 και καλύπτεται από το άφθονο περιθώριο
 * Easting του UTM 35N· βλ. §5.3).
 */
export const GREECE_GEOGRAPHIC_BBOX = {
  minLat: 34.6,
  maxLat: 41.9,
  minLon: 19.3,
  maxLon: 28.5,
} as const;

/** Βήμα δειγματοληψίας του συνόρου, σε μοίρες. Πυκνό αρκετά ώστε τα άκρα να μην ξεφεύγουν. */
const BORDER_SAMPLE_STEP_DEG = 0.1;

/**
 * Πύλη ΜΕΓΕΘΟΥΣ (ADR-716 §5.2 — η κρίσιμη διόρθωση). Η θέση μόνη της ΔΕΝ αρκεί: ένα κτίριο σε
 * mm που τυχαία κάθεται στο (407565, 4502056) mm θα «περνούσε» ως μέτρα. Απαιτούμε ΚΑΙ φυσικά
 * εύλογη διαγώνιο: από 1 m (μικρότερο δεν είναι σχέδιο) έως 100 km (μεγαλύτερο δεν είναι έργο).
 */
export const PLAUSIBLE_DRAWING_EXTENT_M = { min: 1, max: 100_000 } as const;

/** Δειγματοληπτεί από `from` έως `to` (συμπεριλαμβανομένων των άκρων) με βήμα `step`. */
function sampleRange(from: number, to: number, step: number): number[] {
  const values: number[] = [];
  for (let v = from; v < to; v += step) values.push(v);
  values.push(to);
  return values;
}

/**
 * Παράγει το προβολικό παράθυρο δειγματοληπτώντας το ΣΥΝΟΡΟ του γεωγραφικού bbox μέσα από την
 * υπάρχουσα `geographicToGrid()`. Το σύνορο αρκεί: η Transverse Mercator είναι μονότονη ως προς
 * κάθε άξονα εντός μιας ζώνης, άρα τα άκρα E/N βρίσκονται πάντα στις ακμές του ορθογωνίου.
 */
function deriveEnvelope(bbox: typeof GREECE_GEOGRAPHIC_BBOX): ProjectedEnvelope {
  const lats = sampleRange(bbox.minLat, bbox.maxLat, BORDER_SAMPLE_STEP_DEG);
  const lons = sampleRange(bbox.minLon, bbox.maxLon, BORDER_SAMPLE_STEP_DEG);
  const border = [
    ...lats.flatMap(lat => [{ lat, lon: bbox.minLon }, { lat, lon: bbox.maxLon }]),
    ...lons.flatMap(lon => [{ lat: bbox.minLat, lon }, { lat: bbox.maxLat, lon }]),
  ];

  let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
  for (const { lat, lon } of border) {
    const { E, N } = geographicToGrid(lat, lon);
    if (E < minE) minE = E;
    if (E > maxE) maxE = E;
    if (N < minN) minN = N;
    if (N > maxN) maxN = N;
  }
  return { minE, maxE, minN, maxN };
}

/**
 * Το ελληνικό προβολικό παράθυρο (ΕΓΣΑ87 + UTM 34N/35N), **παράγωγο** — ποτέ hardcoded.
 * Υπολογίζεται μία φορά στο module load (~330 κλήσεις προβολής, αμελητέο).
 */
export const GREEK_PROJECTED_GRID_ENVELOPE: ProjectedEnvelope = deriveEnvelope(GREECE_GEOGRAPHIC_BBOX);

/** Πέφτει ΟΛΟ το κουτί (και οι δύο γωνίες) μέσα στο παράθυρο; */
function isInsideEnvelope(extent: RawExtent, scale: number, env: ProjectedEnvelope): boolean {
  const eastings = [extent.min.x * scale, extent.max.x * scale];
  const northings = [extent.min.y * scale, extent.max.y * scale];
  return eastings.every(e => e >= env.minE && e <= env.maxE)
    && northings.every(n => n >= env.minN && n <= env.maxN);
}

/** Είναι η προκύπτουσα διαγώνιος φυσικά εύλογη για σχέδιο; */
function hasPlausibleExtent(extent: RawExtent, scale: number): boolean {
  const diagonalM = Math.hypot(
    (extent.max.x - extent.min.x) * scale,
    (extent.max.y - extent.min.y) * scale,
  );
  return Number.isFinite(diagonalM)
    && diagonalM >= PLAUSIBLE_DRAWING_EXTENT_M.min
    && diagonalM <= PLAUSIBLE_DRAWING_EXTENT_M.max;
}

/**
 * Επιστρέφει τη **ΜΟΝΑΔΙΚΗ** υποψήφια μονάδα που ικανοποιεί ΘΕΣΗ **ΚΑΙ** ΜΕΓΕΘΟΣ, ή `null`
 * («απέχω»). **Fail-closed κατά κατασκευή**: 0 υποψήφιες (η συντριπτική πλειοψηφία — κάτοψη
 * κοντά στο 0,0) ⇒ `null` ⇒ μηδέν αλλαγή συμπεριφοράς· ≥2 υποψήφιες (αδύνατο κατά §5.4, άρα
 * bug ή διευρυμένο παράθυρο) ⇒ επίσης `null`. Τίποτα δεν αποφασίζεται σιωπηλά.
 */
export function identifyUnitsByGeodeticEnvelope<TUnit extends string>(
  extent: RawExtent | null | undefined,
  candidates: readonly GeodeticUnitCandidate<TUnit>[],
  envelope: ProjectedEnvelope = GREEK_PROJECTED_GRID_ENVELOPE,
): TUnit | null {
  if (!extent) return null;
  const coords = [extent.min.x, extent.min.y, extent.max.x, extent.max.y];
  if (!coords.every(Number.isFinite)) return null;

  const matches = candidates.filter(c =>
    Number.isFinite(c.metresPerUnit)
    && c.metresPerUnit > 0
    && isInsideEnvelope(extent, c.metresPerUnit, envelope)
    && hasPlausibleExtent(extent, c.metresPerUnit),
  );
  return matches.length === 1 ? matches[0].unit : null;
}
