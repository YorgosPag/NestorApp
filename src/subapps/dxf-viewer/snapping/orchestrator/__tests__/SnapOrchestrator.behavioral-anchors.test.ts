/**
 * ADR-728 §6 — «Συμπεριφορική ισοδυναμία 100%»: behavioral characterization anchors
 * για τον snap orchestrator, καρφωμένα ΠΡΙΝ μπει το broad phase (Φ2).
 *
 * ## Σκοπός
 *
 * Η Φ2 του ADR-728 θα προσθέσει ένα broad-phase φίλτρο (spatial index) ΠΡΙΝ την είσοδο
 * στον βρόχο engines του `SnapOrchestrator.collectCandidates` — σήμερα κάθε engine
 * σκανάρει ΟΛΗ τη σκηνή (ADR-728 §3.1). Το broad phase οφείλει να αλλάξει **πόσες**
 * οντότητες βλέπει κάθε engine, ΟΧΙ **ποιο σημείο κερδίζει**. Αυτό το αρχείο τρέχει τον
 * ΠΡΑΓΜΑΤΙΚΟ σωλήνα (`ProSnapEngineV2` → `SnapEngineCore` → `SnapOrchestrator` →
 * `SnapEngineRegistry` → πραγματικά engines, ΧΩΡΙΣ κανένα mock) πάνω σε μια συνθετική
 * σκηνή με γνωστές συντεταγμένες, και καρφώνει τα ΠΡΑΓΜΑΤΙΚΑ αποτελέσματα (found,
 * activeMode, snappedPoint, entityId) ως αναμενόμενα.
 *
 * Ημερομηνία: 2026-07-30.
 *
 * ⚠️ **ΑΝ ΚΑΠΟΙΟ ΑΠΟ ΑΥΤΑ ΤΑ TESTS ΚΟΚΚΙΝΙΣΕΙ ΜΕΤΑ ΤΗ Φ2**: αυτό σημαίνει ότι το broad
 * phase ΑΛΛΑΞΕ ποιο σημείο/τύπος κερδίζει σε κάποια θέση κέρσορα — δηλαδή
 * ΠΑΛΙΝΔΡΟΜΗΣΗ ΟΡΘΟΤΗΤΑΣ (correctness regression), όχι «ξεπερασμένο test». Η σωστή
 * ενέργεια είναι να εντοπιστεί ΓΙΑΤΙ το broad phase απέκλεισε/πρόσθεσε λάθος οντότητα
 * (π.χ. λάθος ακτίνα αναζήτησης γύρω από τον κέρσορα σε σχέση με την ανοχή του
 * συγκεκριμένου τύπου) — ΟΧΙ να ξαναγραφτεί το test ώστε να ταιριάζει με τη νέα
 * (λανθασμένη) συμπεριφορά. Μόνο η μέτρηση `SNAP_ENTITY_COUNT_STAGE`
 * (`SnapOrchestrator.collect-candidates.test.ts`) αναμένεται ΝΟΜΙΜΑ να αλλάξει τιμή.
 *
 * ## Τι ΔΕΝ καλύπτεται (τίμια οριοθέτηση)
 *
 * - `QUADRANT`, `TANGENT`, `PERPENDICULAR`, `PARALLEL`, `NEAREST`, `NEAR`, `NODE`,
 *   `EXTENSION`, `INSERTION`, `ORTHO_TRACK`: **ΔΕΝ είναι στο `DEFAULT_PRO_SNAP_SETTINGS.
 *   enabledTypes`** (εύρημα, βλ. περιγραφή #4 πιο κάτω) — δεν τρέχουν καθόλου με default
 *   settings, άρα δεν έχει νόημα να τα χαρακτηρίσουμε εδώ.
 * - `BIM_CORNER` / `BIM_MIDPOINT` / `BIM_CENTER` / `BIM_WALL_FACE` / `BIM_MEP_CONNECTOR`:
 *   απαιτούν BIM entities (wall/beam/slab/column/opening) με το δικό τους
 *   χαρακτηριστικό-σημείων pipeline (`bim-characteristic-points`) — δυσανάλογα βαρύ setup
 *   για ένα generic anchor αρχείο· καλύπτονται ήδη από αφιερωμένα tests
 *   (`bim-corner-alignment.integration.test.ts`, `WallFaceSnapEngine.test.ts`,
 *   `MepConnectorSnapEngine.test.ts`).
 * - `ROTATION_PIVOT` / `ROTATION_GRIP` / `SELECTED_GRIP`: contextual — διαβάζουν singleton
 *   stores (`RotationSnapStore`, `AllGripsStore`) που είναι άδεια χωρίς ενεργό
 *   rotation/selection. Καλύπτονται από `RotationPointSnapEngine.test.ts` /
 *   `SelectedGripSnapEngine.test.ts`. Εδώ απλώς επαληθεύουμε ότι η απουσία τους δεν
 *   ρίχνει exception (η σκηνή μας δεν επιλέγει/περιστρέφει τίποτα).
 * - `DIM_DEF_POINT` / `DIM_LINE` / `GUIDE` / `CONSTRUCTION_POINT`: χρειάζονται dimension
 *   entities / guides / construction points — καμία στη συνθετική μας σκηνή, άρα τρέχουν
 *   αλλά επιστρέφουν πάντα 0 candidates (καλυμμένο έμμεσα από τα «καμία σύγκρουση» tests).
 * - `COMPLEX_ENDPOINT` / `COMPLEX_MIDPOINT` / `COMPLEX_INTERSECTION`: απαιτούν rendered
 *   complex-linetype pattern γεωμετρία (σιδηρόδρομος) — καλύπτονται από
 *   `ComplexLinetypeSnapEngine.test.ts` / `complex-linetype-snap-geometry.test.ts`.
 *
 * ## Οικογένειες που ΚΑΛΥΠΤΟΝΤΑΙ εδώ
 *
 * ENDPOINT (γραμμή + πολυγραμμή), MIDPOINT, CENTER (κύκλος), INTERSECTION
 * (γραμμή×γραμμή), TEXT (insertion point), GRID (σιωπηλό fallback σε κενό χώρο) — και
 * ένα σενάριο ανταγωνισμού ENDPOINT/INTERSECTION/MIDPOINT στο ΙΔΙΟ ακριβώς σημείο.
 */

import { ProSnapEngineV2 } from '../../ProSnapEngineV2';
import { ExtendedSnapType, type Entity } from '../../extended-types';

// ── Σταθερό viewport stub — 0,5 world units ανά pixel, χωρίς μετασχηματισμό ─────────
// (worldToScreen ταυτοτική συνάρτηση: αρκεί για engines που τη χρησιμοποιούν εσωτερικά).
function makeViewport() {
  return {
    worldPerPixelAt: () => 0.5,
    worldToScreen: (p: { x: number; y: number }) => p,
    scale: 1,
  };
}

// ── Συνθετική σκηνή — ζώνες χωρισμένες κατά ≥150 world units ώστε οι ανοχές (≤6
// world units στα default per-mode px tolerances × 0,5 wpp) να ΜΗΝ επικαλύπτονται. ──

// Ζώνη A (x: 0-100, y: 0) — γραμμή για ENDPOINT + MIDPOINT.
const lineA: Entity = {
  id: 'lineA',
  type: 'line',
  layerId: 'lyr_test',
  start: { x: 0, y: 0 },
  end: { x: 100, y: 0 },
} as unknown as Entity;

// Ζώνη B (x: 300) — κύκλος για CENTER.
const circleB: Entity = {
  id: 'circleB',
  type: 'circle',
  layerId: 'lyr_test',
  center: { x: 300, y: 0 },
  radius: 40,
} as unknown as Entity;

// Ζώνη C (x: 550-640) — δύο γραμμές που τέμνονται σε (600, 25), ΧΩΡΙΣ να συμπίπτει με
// κανένα endpoint/midpoint (η lineC2 είναι ΕΠΙΤΗΔΕΣ ασύμμετρη: midpoint = (595, 25)).
const lineC1: Entity = {
  id: 'lineC1',
  type: 'line',
  layerId: 'lyr_test',
  start: { x: 600, y: -50 },
  end: { x: 600, y: 50 },
} as unknown as Entity;
const lineC2: Entity = {
  id: 'lineC2',
  type: 'line',
  layerId: 'lyr_test',
  start: { x: 550, y: 25 },
  end: { x: 640, y: 25 },
} as unknown as Entity;

// Ζώνη D (x: 800) — ΤΡΙΠΛΗ σύμπτωση στο ΙΔΙΟ σημείο (800, 0):
//   - lineD1.start          → ENDPOINT
//   - lineD1 × lineD2       → INTERSECTION
//   - lineD2 midpoint       → MIDPOINT
const lineD1: Entity = {
  id: 'lineD1',
  type: 'line',
  layerId: 'lyr_test',
  start: { x: 800, y: 0 },
  end: { x: 900, y: 0 },
} as unknown as Entity;
const lineD2: Entity = {
  id: 'lineD2',
  type: 'line',
  layerId: 'lyr_test',
  start: { x: 800, y: -50 },
  end: { x: 800, y: 50 },
} as unknown as Entity;

// Ζώνη E (x: 1100) — ανοιχτή πολυγραμμή με ενδιάμεση κορυφή (direction-change vertex).
const polylineE: Entity = {
  id: 'polylineE',
  type: 'polyline',
  layerId: 'lyr_test',
  closed: false,
  vertices: [
    { x: 1100, y: 0 },
    { x: 1150, y: 0 },   // ενδιάμεση κορυφή (ENDPOINT-tier στο EndpointSnapEngine)
    { x: 1150, y: 50 },
  ],
} as unknown as Entity;

// Ζώνη F (x: 1400) — κείμενο, μόνο το insertion point (position) χαρακτηρίζεται εδώ·
// τα υπόλοιπα 9 σημεία (γωνίες/κέντρο/άκρα bbox) καλύπτονται από TextSnapEngine.test.ts.
const textF: Entity = {
  id: 'textF',
  type: 'text',
  layerId: 'lyr_test',
  text: 'AB',
  position: { x: 1400, y: 0 },
  fontSize: 10,
  rotation: 0,
  visible: true,
} as unknown as Entity;

const scene: Entity[] = [lineA, circleB, lineC1, lineC2, lineD1, lineD2, polylineE, textF];

function makeEngine(): ProSnapEngineV2 {
  const engine = new ProSnapEngineV2();
  engine.initialize(scene, makeViewport());
  return engine;
}

describe('ADR-728 §6 — SnapOrchestrator behavioral anchors (real engine, real registry, no mocks)', () => {
  let engine: ProSnapEngineV2;

  beforeEach(() => {
    engine = makeEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  // ── (α) Κοντά σε endpoint ──────────────────────────────────────────────────────
  it('κέρσορας κοντά στο endpoint μιας γραμμής → ENDPOINT στο ακριβές σημείο', () => {
    const result = engine.findSnapPoint({ x: 1, y: 1 });
    expect(result.found).toBe(true);
    expect(result.activeMode).toBe(ExtendedSnapType.ENDPOINT);
    expect(result.snappedPoint.x).toBeCloseTo(0, 6);
    expect(result.snappedPoint.y).toBeCloseTo(0, 6);
    expect(result.snapPoint?.entityId).toBe('lineA');
  });

  // ── (α) Κοντά σε midpoint ───────────────────────────────────────────────────────
  it('κέρσορας κοντά στο midpoint μιας γραμμής → MIDPOINT στο ακριβές σημείο', () => {
    const result = engine.findSnapPoint({ x: 50, y: 3 });
    expect(result.found).toBe(true);
    expect(result.activeMode).toBe(ExtendedSnapType.MIDPOINT);
    expect(result.snappedPoint.x).toBeCloseTo(50, 6);
    expect(result.snappedPoint.y).toBeCloseTo(0, 6);
    expect(result.snapPoint?.entityId).toBe('lineA');
  });

  // ── (α) Κοντά σε κέντρο κύκλου ──────────────────────────────────────────────────
  it('κέρσορας κοντά στο κέντρο ενός κύκλου → CENTER στο ακριβές κέντρο', () => {
    const result = engine.findSnapPoint({ x: 301, y: 1 });
    expect(result.found).toBe(true);
    expect(result.activeMode).toBe(ExtendedSnapType.CENTER);
    expect(result.snappedPoint.x).toBeCloseTo(300, 6);
    expect(result.snappedPoint.y).toBeCloseTo(0, 6);
    expect(result.snapPoint?.entityId).toBe('circleB');
  });

  // ── (α) Κοντά σε τομή δύο γραμμών ────────────────────────────────────────────────
  it('κέρσορας κοντά στην τομή δύο γραμμών (χωρίς σύμπτωση με endpoint/midpoint) → INTERSECTION', () => {
    const result = engine.findSnapPoint({ x: 601, y: 24 });
    expect(result.found).toBe(true);
    expect(result.activeMode).toBe(ExtendedSnapType.INTERSECTION);
    expect(result.snappedPoint.x).toBeCloseTo(600, 6);
    expect(result.snappedPoint.y).toBeCloseTo(25, 6);
  });

  // ── (α) Κοντά σε ενδιάμεση κορυφή πολυγραμμής ────────────────────────────────────
  it('κέρσορας κοντά σε ΕΝΔΙΑΜΕΣΗ κορυφή ανοιχτής πολυγραμμής → ENDPOINT (Revit-grade osnap)', () => {
    const result = engine.findSnapPoint({ x: 1151, y: 1 });
    expect(result.found).toBe(true);
    expect(result.activeMode).toBe(ExtendedSnapType.ENDPOINT);
    expect(result.snappedPoint.x).toBeCloseTo(1150, 6);
    expect(result.snappedPoint.y).toBeCloseTo(0, 6);
    expect(result.snapPoint?.entityId).toBe('polylineE');
  });

  // ── (α) Κείμενο — insertion point ────────────────────────────────────────────────
  it('κέρσορας ακριβώς στο insertion point ενός text entity → TEXT (text-insertion)', () => {
    const result = engine.findSnapPoint({ x: 1400, y: 0 });
    expect(result.found).toBe(true);
    expect(result.activeMode).toBe(ExtendedSnapType.TEXT);
    expect(result.snappedPoint.x).toBeCloseTo(1400, 6);
    expect(result.snappedPoint.y).toBeCloseTo(0, 6);
    expect(result.snapPoint?.description).toBe('text-insertion');
    expect(result.snapPoint?.entityId).toBe('textF');
  });

  // ── (β) Κενός χώρος — κανένα snap ────────────────────────────────────────────────
  it('κέρσορας σε κενό χώρο (μακριά από κάθε entity ΚΑΙ από κάθε grid intersection) → not found', () => {
    // (475, 475): πλησιέστερο grid point (gridStep=50) = (500, 500), απόσταση ≈35,4 —
    // πολύ πέρα από την ανοχή GRID (10px × 0,5 wpp = 5 world units).
    const result = engine.findSnapPoint({ x: 475, y: 475 });
    expect(result.found).toBe(false);
    expect(result.activeMode).toBeNull();
    expect(result.snapPoint).toBeNull();
    // Χωρίς snap, το σημείο επιστρέφεται αυτούσιο (identity — δεν «κολλάει» πουθενά).
    expect(result.snappedPoint).toEqual({ x: 475, y: 475 });
  });

  // ── (γ) Οριακά ΕΝΤΟΣ / ΕΚΤΟΣ aperture — ίδιο endpoint, δύο πλευρές του ορίου ─────
  // ENDPOINT tolerance = 10px × worldPerPixelAt(0,5) = 5,0 world units ακριβώς.
  describe('όριο aperture γύρω από endpoint (800, 0) — ακτίνα 5,0 world units', () => {
    it('4,9 units (ΕΝΤΟΣ) → found, νικητής INTERSECTION (ίδιο σημείο (800,0) όπως στο σενάριο (δ))', () => {
      const result = engine.findSnapPoint({ x: 800, y: 4.9 });
      expect(result.found).toBe(true);
      expect(result.snappedPoint.x).toBeCloseTo(800, 6);
      expect(result.snappedPoint.y).toBeCloseTo(0, 6);
      // Εδώ η απόσταση (4,9) είναι πάνω από το sub-pixel early-exit όριο (0,75), άρα ΚΑΙ
      // οι τρεις engines (INTERSECTION/ENDPOINT/MIDPOINT) τρέχουν κανονικά και παράγουν
      // υποψήφιο — αντίθετα με το σενάριο (δ) στο distance=0. Ο νικητής παραμένει
      // INTERSECTION (ίδια ισοπαλία priority=0 με ENDPOINT, ίδια σειρά εισαγωγής).
      expect(result.activeMode).toBe(ExtendedSnapType.INTERSECTION);
      // 🔴 ΕΥΡΗΜΑ: (800,0) είναι ΚΑΙ σημείο πλέγματος (gridStep=50 — 800 και 0 είναι
      // πολλαπλάσια του 50) — άρα το GLOBAL GridSnapEngine (τρέχει ΠΑΝΤΟΤΕ, ανεξάρτητα
      // οντοτήτων) προσθέτει ΚΑΙ αυτό υποψήφιο εδώ. Δεν κερδίζει (GRID priority 12/13,
      // πολύ χαμηλότερο από 0/1) αλλά ΕΙΝΑΙ παρόν στο allCandidates — τίμια καταγραφή,
      // όχι κρυφή απόρριψη.
      const modes = result.allCandidates.map(c => c.type).sort();
      expect(modes).toEqual(
        [
          ExtendedSnapType.ENDPOINT,
          ExtendedSnapType.GRID,
          ExtendedSnapType.INTERSECTION,
          ExtendedSnapType.MIDPOINT,
        ].sort(),
      );
    });

    it('5,1 units (ΕΚΤΟΣ) → not found', () => {
      const result = engine.findSnapPoint({ x: 800, y: 5.1 });
      expect(result.found).toBe(false);
      expect(result.activeMode).toBeNull();
    });
  });

  // ── (δ) Ανταγωνισμός τύπων στο ΙΔΙΟ σημείο ───────────────────────────────────────
  // (800, 0) είναι ΤΑΥΤΟΧΡΟΝΑ: ENDPOINT της lineD1 (priority 0), INTERSECTION της
  // lineD1×lineD2 (priority 0 — ΙΣΟΠΑΛΙΑ με ENDPOINT), και MIDPOINT της lineD2
  // (priority 1). Απόσταση 0 και για τους τρεις υποψήφιους.
  it('τρεις τύποι συμπίπτουν ΑΚΡΙΒΩΣ στο ίδιο σημείο → καρφωμένος πραγματικός νικητής', () => {
    const result = engine.findSnapPoint({ x: 800, y: 0 });
    expect(result.found).toBe(true);
    expect(result.snappedPoint.x).toBeCloseTo(800, 6);
    expect(result.snappedPoint.y).toBeCloseTo(0, 6);
    expect(result.activeMode).toBe(ExtendedSnapType.INTERSECTION);
    expect(result.snapPoint?.priority).toBe(0);

    // 🔴 ΕΥΡΗΜΑ (πιο δυνατό από απλή ισοπαλία προτεραιότητας): το `allCandidates` έχει
    // ΜΟΝΟ ΕΝΑ στοιχείο — η INTERSECTION engine τρέχει ΠΡΩΤΗ από τις τρεις (σειρά στο
    // `DEFAULT_PRO_SNAP_SETTINGS.priority`), βρίσκει candidate σε distance=0, και το
    // sub-pixel early-exit του `collectCandidates` (`hasEnoughCandidates`,
    // SnapOrchestrator.ts) ΣΤΑΜΑΤΑ ΟΛΟΚΛΗΡΟ τον βρόχο engines — 0 ≤ 1,5px×0,5wpp=0,75.
    // Οι ENDPOINT και MIDPOINT engines ΔΕΝ τρέχουν καν εδώ· δεν είναι ότι «χάνουν» μια
    // ισοπαλία προτεραιότητας — απλά δεν παράγεται ποτέ υποψήφιός τους. Η Φ2 πρέπει να
    // διατηρήσει αυτό το ΙΔΙΟ αποτέλεσμα (μία μόνο εγγραφή, INTERSECTION) ακόμα κι αν
    // αλλάξει ΠΟΣΕΣ οντότητες βλέπει κάθε engine.
    expect(result.allCandidates).toHaveLength(1);
    expect(result.allCandidates[0].type).toBe(ExtendedSnapType.INTERSECTION);
  });

  // ── Αντοχή: contextual engines (ROTATION_PIVOT/GRIP, SELECTED_GRIP) χωρίς ενεργό
  // rotation/selection ΔΕΝ ρίχνουν exception και δεν παράγουν φανταστικούς υποψήφιους. ──
  it('contextual engines (rotation/selected-grip) είναι σιωπηλά όταν καμία λειτουργία δεν είναι ενεργή', () => {
    expect(() => engine.findSnapPoint({ x: 475, y: 475 })).not.toThrow();
    const result = engine.findSnapPoint({ x: 475, y: 475 });
    expect(result.allCandidates.some(c =>
      c.type === ExtendedSnapType.ROTATION_PIVOT
      || c.type === ExtendedSnapType.ROTATION_GRIP
      || c.type === ExtendedSnapType.SELECTED_GRIP,
    )).toBe(false);
  });
});
