/**
 * ADR-716 Φ2 — ΣΚΑΛΑ ΤΕΚΜΗΡΙΩΝ για τη μονάδα του εισαγόμενου DXF.
 *
 * > **Αρχή**: η μονάδα δεν είναι μαντεψιά — είναι **ετυμηγορία με αποδεικτικά**. Ό,τι δεν
 * > αποδεικνύεται, **απέχει** και περνά στο επόμενο σκαλί. Τίποτα δεν αποφασίζεται σιωπηλά.
 *
 * | # | Τεκμήριο | `confidence` |
 * |---|---|---|
 * | 0 | Ρητή επιλογή χρήστη (wizard) | `explicit` — πάντα νικά, το δίδαγμα ΟΛΩΝ των μεγάλων |
 * | 1 | **Γεωδαιτικό envelope** (θέση ΚΑΙ μέγεθος, ακριβώς 1 υποψήφια) | `identified` |
 * | 2 | `$INSUNITS ≠ 0` | `declared` |
 * | 3 | Ευρετική διαγωνίου (ή το mm-ψέμα carve-out) | `weak` |
 * | 4 | `'mm'` | `default` — ιστορικό back-compat |
 * | — | `$MEASUREMENT` | **ΔΕΝ χρησιμοποιείται** (ADR-716 §4: στο πραγματικό δείγμα δίνει ίντσες) |
 *
 * Το σκαλί 1 τοποθετείται **πάνω** από το `$INSUNITS` επειδή είναι **ταυτοποίηση, όχι
 * ευρετική**: το πολύ μία μονάδα μπορεί να το περάσει (απόδειξη στο `projected-crs-envelopes`).
 * Μια συντεταγμένη ΕΓΣΑ87 δεν λέει ψέματα· μια δήλωση `$INSUNITS` λέει — αυτό είναι ακριβώς η
 * κλάση σφάλματος που ήδη αντιμετωπίζει το mm-ψέμα carve-out του ADR-362 R20.
 *
 * ## Γιατί ΧΩΡΙΣΤΟ module από το `scene-units.ts`
 *
 * Το `scene-units.ts` είναι η SSoT των μονάδων και βρίσκεται **κάτω** από το
 * `systems/geo-referencing/` στο γράφημα εξαρτήσεων. Αν η σκάλα ζούσε εκεί, η ακμή προς την
 * προβολή θα έκλεινε **κύκλο** (`scene-units → envelopes → scene-units`). Εδώ η ροή είναι
 * μονόδρομη: `import-unit-decision → { scene-units, projected-crs-envelopes }`. Επιπλέον το
 * `scene-units.ts` είναι ήδη στις ~400 γραμμές (όριο N.7.1 = 500).
 *
 * **Καμία λογική δεν αντιγράφεται**: τα σκαλιά 2–4 τα εκτελεί αυτούσια η υπάρχουσα
 * `computeUnitSuggestion` (που με τη σειρά της καλεί `resolveImportSourceUnits`). Αυτό το module
 * προσθέτει ΜΟΝΟ τα σκαλιά 0–1 και το αποδεικτικό υλικό.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-716-geodetic-unit-identification-dxf-import.md §8
 */
import {
  computeUnitSuggestion,
  insunitsCodeToSceneUnits,
  resolveUnitDetectionBounds,
  sceneUnitsToMeters,
  type DetectionBounds,
  type SceneUnits,
} from './scene-units';
// Απευθείας στο αρχείο — ΠΟΤΕ μέσω του barrel `geo-referencing/index.ts` (CHECK 3.30 barrel
// dead-export ratchet· επιπλέον ο parse worker δεν πρέπει να τραβήξει όλο το subsystem).
import {
  identifyUnitsByGeodeticEnvelope,
  type GeodeticUnitCandidate,
} from '../systems/geo-referencing/projected-crs-envelopes';

/** Πόσο ισχυρό είναι το τεκμήριο πίσω από την επιλεγμένη μονάδα (φθίνουσα σειρά). */
export type UnitConfidence = 'explicit' | 'identified' | 'declared' | 'weak' | 'default';

/** Στατικά i18n κλειδιά — ΠΟΤΕ έτοιμο κείμενο στον κώδικα (N.11). */
export const UNIT_EVIDENCE_KEYS: Readonly<Record<UnitConfidence, string>> = {
  explicit: 'floorplanImport.drawingUnits.evidence.explicit',
  identified: 'floorplanImport.drawingUnits.evidence.geodetic',
  declared: 'floorplanImport.drawingUnits.evidence.declared',
  weak: 'floorplanImport.drawingUnits.evidence.magnitude',
  default: 'floorplanImport.drawingUnits.evidence.fallback',
};

/** Η ετυμηγορία: τι μονάδα, με τι τεκμήριο, και τι μέγεθος βγάζει αυτό στον πραγματικό κόσμο. */
export interface UnitDecision {
  readonly units: SceneUnits;
  readonly confidence: UnitConfidence;
  /** Στατικό i18n κλειδί — ΠΟΤΕ έτοιμο κείμενο (N.11). */
  readonly evidenceKey: string;
  /** Τι ΔΗΛΩΝΕΙ το `$INSUNITS` (null = unitless / μονάδα που δεν μοντελοποιούμε). */
  readonly declared: SceneUnits | null;
  /** Διαφωνεί η δήλωση με την ετυμηγορία; Τροφοδοτεί την υπάρχουσα προειδοποίηση του wizard. */
  readonly mismatch: boolean;
  /** Το προκύπτον μέγεθος σε ΜΕΤΡΑ — αυτό που επαληθεύει ο μηχανικός με το μάτι (§8.1). */
  readonly resultingExtentM: { readonly width: number; readonly height: number } | null;
}

/** Οι υποψήφιες ερμηνείες, παραγμένες από τη SSoT μετατροπής — κανένας μαγικός αριθμός. */
const ALL_SCENE_UNITS: readonly SceneUnits[] = ['mm', 'cm', 'm', 'in', 'ft'];
export const SCENE_UNIT_GEODETIC_CANDIDATES: readonly GeodeticUnitCandidate<SceneUnits>[] =
  ALL_SCENE_UNITS.map(unit => ({ unit, metresPerUnit: sceneUnitsToMeters(unit) }));

/** Το extent σε ΜΕΤΡΑ, δεδομένης της ετυμηγορίας. `null` όταν δεν υπάρχει αξιοποιήσιμο extent. */
function resultingExtentInMetres(
  bounds: DetectionBounds | null,
  units: SceneUnits,
): { width: number; height: number } | null {
  if (!bounds) return null;
  const perUnit = sceneUnitsToMeters(units);
  const width = (bounds.max.x - bounds.min.x) * perUnit;
  const height = (bounds.max.y - bounds.min.y) * perUnit;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
}

/** Συναρμολογεί την ετυμηγορία γύρω από μια ήδη επιλεγμένη μονάδα. */
function decide(
  units: SceneUnits,
  confidence: UnitConfidence,
  declared: SceneUnits | null,
  bounds: DetectionBounds | null,
): UnitDecision {
  return {
    units,
    confidence,
    evidenceKey: UNIT_EVIDENCE_KEYS[confidence],
    declared,
    mismatch: declared != null && declared !== units,
    resultingExtentM: resultingExtentInMetres(bounds, units),
  };
}

/**
 * Η πλήρης σκάλα τεκμηρίων (ADR-716 §8) — ΕΝΑ σημείο απόφασης για ΟΛΟ το import.
 *
 * Καλείται και από τη διαδρομή κλιμάκωσης (`resolveSourceUnits` → `applyCanonicalMmScale`) και
 * από τον καθρέφτη του wizard (`useDxfUnitSuggestion`), ώστε **αυτό που δείχνει η οθόνη να
 * είναι κατά κατασκευή αυτό που εκτελεί ο importer** — όχι δεύτερη, παράλληλη ευρετική.
 */
export function resolveImportSourceUnitsWithEvidence(
  insunitsCode: number | null | undefined,
  declaredExtents: DetectionBounds | null | undefined,
  computedBounds?: DetectionBounds | null,
  unitsOverride?: SceneUnits,
): UnitDecision {
  const detectionBounds = resolveUnitDetectionBounds(declaredExtents, computedBounds);
  const declared = insunitsCodeToSceneUnits(insunitsCode);

  // Σκαλί 0 — η ρητή επιλογή του μηχανικού νικά τα πάντα.
  if (unitsOverride) return decide(unitsOverride, 'explicit', declared, detectionBounds);

  // Σκαλί 1 — ταυτοποίηση από τη ΘΕΣΗ. Fail-closed: `null` ⇒ απλώς περνάμε παρακάτω.
  const identified = identifyUnitsByGeodeticEnvelope(detectionBounds, SCENE_UNIT_GEODETIC_CANDIDATES);
  if (identified) return decide(identified, 'identified', declared, detectionBounds);

  // Σκαλιά 2–4 — αυτούσια η υπάρχουσα συμπεριφορά (ADR-462 / ADR-362 R20), μηδέν αντιγραφή.
  const suggestion = computeUnitSuggestion(insunitsCode, declaredExtents, computedBounds);
  const confidence: UnitConfidence = declared != null
    ? (suggestion.mismatch ? 'weak' : 'declared')   // mismatch ⇒ το mm-ψέμα carve-out μίλησε
    : (detectionBounds ? 'weak' : 'default');       // χωρίς δήλωση: ευρετική, αλλιώς back-compat 'mm'
  return decide(suggestion.suggested, confidence, declared, detectionBounds);
}
