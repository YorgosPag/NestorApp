/**
 * Δυναμικό βάθος θεμελίωσης — pure engine (ADR-489 §6.2).
 *
 * SHARED building-domain module: το εισάγουν ΚΑΙ ο dxf-viewer (πραγματικά πέδιλα του
 * οργανισμού) ΚΑΙ το `building-management` Quick Setup form (seed στο bootstrap) — ΕΝΑ
 * engine, μηδέν διπλότυπο, καμία παραβίαση dependency-direction (κανείς δεν εισάγει από
 * το dxf-viewer subapp).
 *
 * Λύνει το «το βάθος θεμελίωσης είναι χειροκίνητη σταθερά» (ADR-487 §6.2): η εφαρμογή
 * γνωρίζει ορόφους/στάθμες αλλά ΟΧΙ μέγεθος/φορτία εκ των προτέρων → δεν ξέρει το βάθος
 * από την αρχή. Εδώ **παράγεται δυναμικά**:
 *
 *   `resolveDerivedFoundationDepthMm(input)` → βάθος (mm) = πόσο κάτω από τη στάθμη
 *   κάθεται η **άνω παρειά** της θεμελίωσης (= μέτρο του FFL του ορόφου Θεμελίωσης).
 *
 * Formula (Revit/EC7-grade πρακτική):
 *   depth = max(
 *     maxFootingThickness + (συνδετήρια ? tieBeamRise : 0) + soilCover,   // τα στοιχεία χωνεύουν
 *     groundSlabThickness + soilCover,                                    // εδαφόπλακα
 *     frostMin                                                           // γεωτεχνικό ελάχιστο
 *   )  → στρογγυλεμένο ΠΡΟΣ ΤΑ ΠΑΝΩ σε module 50mm.
 *
 * 🔒 **Μη-κυκλικό by design (type-level guarantee):** το input δέχεται ΜΟΝΟ διαστάσεις
 * στοιχείων (πάχη/ύπαρξη συνδετήριας/άνοδος) — ΠΟΤΕ `topElevation`/`foundationFloorElevation`.
 * Έτσι η ροή είναι μονόδρομη: depth → foundation FFL → footing topElevation, χωρίς να
 * διαβάζει ποτέ το topElevation πίσω (που θα δημιουργούσε feedback loop).
 *
 * 🔁 **SSoT των domain τιμών = ο caller (όχι το engine):** το `tieBeamRiseMm` περνιέται ως
 * input ώστε ο dxf-viewer να δίνει το δικό του `TIE_BEAM_RISE_MM` (foundation-types SSoT)
 * — το engine ΔΕΝ κρατά δικό του ανταγωνιστικό αντίγραφο. Τα soilCover/frostMin/module
 * είναι policy αμιγώς του §6.2 (δεν υπάρχουν αλλού) → ζουν εδώ ως SSoT.
 *
 * Pure — zero React/DOM/Firestore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-489-column-footing-continuity-dynamic-foundation-depth.md
 */

/**
 * mm — bootstrap fallback για την άνοδο συνδετήριας πάνω από το πέδιλο (EC8 §5.4.1.2),
 * όταν ο caller δεν δίνει το δικό του SSoT. Ο dxf-viewer περνά το `TIE_BEAM_RISE_MM` του.
 */
export const DEFAULT_TIE_BEAM_RISE_MM = 500;

/** mm — bootstrap assumption πάχους πεδίλου όταν δεν υπάρχουν ακόμη πραγματικά πέδιλα. */
export const ASSUMED_FOOTING_THICKNESS_MM = 500;

/**
 * mm — κάλυψη εδάφους πάνω από τα στοιχεία θεμελίωσης (§6.2 policy SSoT — δεν υπάρχει αλλού):
 * τόσο χώμα μένει πάνω από την άνω παρειά τους ώστε να μην εξέχουν στη στάθμη.
 */
export const FOUNDATION_SOIL_COVER_MM = 200;

/**
 * mm — γεωτεχνικό ελάχιστο βάθος θεμελίωσης (§6.2 policy SSoT — τυπικό όριο παγετού/
 * φυτικών γαιών, EC7): η άνω παρειά της θεμελίωσης δεν επιτρέπεται να είναι ρηχότερα.
 */
export const FOUNDATION_FROST_MIN_MM = 800;

/** mm — βήμα στρογγυλοποίησης (module) του δυναμικού βάθους (§6.2 policy SSoT). */
export const FOUNDATION_DEPTH_MODULE_MM = 50;

/** Είσοδος engine — ΜΟΝΟ διαστάσεις στοιχείων (μη-κυκλικό: κανένα elevation). */
export interface DerivedFoundationDepthInput {
  /** mm — πάχη ΟΛΩΝ των πεδίλων (pad/strip). Κενό → seed πάχος. */
  readonly footingThicknessesMm: readonly number[];
  /** Υπάρχει συνδετήρια δοκός; (κάθεται `tieBeamRiseMm` ψηλότερα, EC8). */
  readonly hasTieBeam: boolean;
  /** mm — πάχος εδαφόπλακας αν υπάρχει, αλλιώς 0/undefined. */
  readonly groundSlabThicknessMm?: number;
  /** mm — άνοδος συνδετήριας πάνω από το πέδιλο (caller SSoT· default EC8 fallback). */
  readonly tieBeamRiseMm?: number;
}

/** Στρογγυλοποίηση ΠΡΟΣ ΤΑ ΠΑΝΩ σε module (ασφαλές: το βάθος δεν μικραίνει). */
function roundUpToModule(valueMm: number, moduleMm: number): number {
  return Math.ceil(valueMm / moduleMm) * moduleMm;
}

/**
 * DERIVED βάθος θεμελίωσης (mm) από τον οργανισμό. Πάντα ≥ γεωτεχνικό ελάχιστο.
 */
export function resolveDerivedFoundationDepthMm(input: DerivedFoundationDepthInput): number {
  const maxFootingThicknessMm = input.footingThicknessesMm.length > 0
    ? Math.max(...input.footingThicknessesMm)
    : ASSUMED_FOOTING_THICKNESS_MM;
  const tieBeamRiseMm = input.tieBeamRiseMm ?? DEFAULT_TIE_BEAM_RISE_MM;
  const tieBeamTermMm = input.hasTieBeam ? tieBeamRiseMm : 0;
  const groundSlabMm = input.groundSlabThicknessMm ?? 0;

  const elementsTermMm = maxFootingThicknessMm + tieBeamTermMm + FOUNDATION_SOIL_COVER_MM;
  const slabTermMm = groundSlabMm > 0 ? groundSlabMm + FOUNDATION_SOIL_COVER_MM : 0;

  const rawMm = Math.max(elementsTermMm, slabTermMm, FOUNDATION_FROST_MIN_MM);
  return roundUpToModule(rawMm, FOUNDATION_DEPTH_MODULE_MM);
}

/**
 * Convenience: το seed βάθος (mm) στο bootstrap (Quick Setup) όπου δεν υπάρχουν ακόμη
 * πραγματικά πέδιλα — τυπικό πέδιλο + συνδετήριες (Ελληνικό RC/EC8 norm). Δίνει 1200mm
 * (= πέδιλο 500 + συνδετήριες 500 + κάλυψη 200), ώστε το «Auto» στο dialog να είναι
 * ρεαλιστικό seed αντί για χειροκίνητη σταθερά.
 */
export function seedDerivedFoundationDepthMm(): number {
  return resolveDerivedFoundationDepthMm({
    footingThicknessesMm: [ASSUMED_FOOTING_THICKNESS_MM],
    hasTieBeam: true,
  });
}
