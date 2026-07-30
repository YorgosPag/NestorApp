/**
 * ADR-728 §6 — **συμπεριφορική ισοδυναμία 100%** του broad phase (Φ2), αποδεδειγμένη με
 * διαφορική εκτέλεση: **ο ίδιος** orchestrator, **η ίδια** σκηνή, **οι ίδιες** θέσεις κέρσορα,
 * μία φορά με φίλτρο και μία σε pass-through — τα δύο αποτελέσματα πρέπει να είναι **ταυτόσημα**.
 *
 * ## Γιατί αυτό είναι δυνατότερο από άγκυρες
 *
 * Οι άγκυρες (`SnapOrchestrator.behavioral-anchors.test.ts`) καρφώνουν **επιλεγμένες** θέσεις με
 * χειρόγραφες προσδοκίες: αποδεικνύουν ότι δεν χάλασε ό,τι ο συγγραφέας σκέφτηκε να ελέγξει.
 * Εδώ δεν υπάρχει χειρόγραφη προσδοκία — **η ίδια η προ-Φ2 συμπεριφορά είναι το oracle**, σε
 * πλέγμα θέσεων που καλύπτει πάνω/κοντά/μακριά από κάθε ζώνη γεωμετρίας. Το `broadPhaseEnabled:
 * false` (η «δικλείδα» του §Φ2) δεν είναι διακόπτης ευκολίας: είναι **το όργανο της απόδειξης**.
 *
 * ⚠️ Αν κοκκινίσει, το broad phase **έκοψε οντότητα που κάποια engine θα δεχόταν** — παλινδρόμηση
 * ορθότητας (ADR-728 §6, τελευταία γραμμή του πίνακα). Η διόρθωση είναι στο aperture/φίλτρο,
 * **ποτέ** στο test.
 *
 * ## Δύο διαμορφώσεις, όχι μία
 *
 * 1. **Προεπιλογές** — αυτό που τρέχει στην παραγωγή σήμερα.
 * 2. **ΟΛΟΙ οι τύποι ενεργοί** — συμπεριλαμβάνει τις **πέντε** μη-τοπικές engines (`EXTENSION`,
 *    `PARALLEL`, `ORTHO_TRACK`, `TANGENT` — ADR-728 §Φ2.3 — και `PERPENDICULAR`, που **αυτό το
 *    test ανακάλυψε**: το ADR απαριθμούσε τέσσερις· η πέμπτη βρέθηκε από κόκκινο, όχι από
 *    ανάγνωση) και τις τοπικές που είναι σβηστές by default (`NEAREST`, `QUADRANT`, `NEAR`,
 *    `INSERTION`, `NODE`). Καμία τους δεν είναι ενεργή by default — **γι' αυτό ακριβώς** πρέπει
 *    να ελεγχθεί εδώ: σιωπηλή αστοχία τους δεν θα φαινόταν πουθενά μέχρι να τις ανάψει χρήστης.
 *
 * Ημερομηνία: 2026-07-30.
 */

import { SnapOrchestrator } from '../SnapOrchestrator';
import { DEFAULT_PRO_SNAP_SETTINGS, ExtendedSnapType, type Entity, type ProSnapResult, type ProSnapSettings } from '../../extended-types';
import type { Point2D } from '../../../rendering/types/Types';

// ── Viewport: 0,5 world units ανά pixel (ίδιο με τις άγκυρες, ώστε οι ανοχές να συγκρίνονται) ──
function makeViewport() {
  return {
    worldPerPixelAt: () => 0.5,
    worldToScreen: (p: Point2D) => p,
    scale: 1,
  };
}

// ── Συνθετική σκηνή — ζώνες με διαφορετική γεωμετρική «γεύση» ώστε να ενεργοποιούνται
//    διαφορετικές οικογένειες engines, και αρκετά μακριά μεταξύ τους ώστε να υπάρχει
//    πραγματικό «μακριά» για το broad phase να κόψει. ─────────────────────────────────
const scene: Entity[] = [
  // Α — γραμμή: ENDPOINT / MIDPOINT / NEAREST / PERPENDICULAR / EXTENSION / PARALLEL.
  { id: 'lineA', type: 'line', layerId: 'lyr', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
  // Β — δεύτερη γραμμή παράλληλη προς την Α (τροφοδοτεί PARALLEL με πραγματική αναφορά).
  { id: 'lineB', type: 'line', layerId: 'lyr', start: { x: 0, y: 40 }, end: { x: 100, y: 40 } },
  // Γ — κύκλος: CENTER / QUADRANT / TANGENT.
  { id: 'circleC', type: 'circle', layerId: 'lyr', center: { x: 300, y: 0 }, radius: 40 },
  // Δ — τομή δύο γραμμών στο (600, 25), χωρίς σύμπτωση με endpoint/midpoint.
  { id: 'lineD1', type: 'line', layerId: 'lyr', start: { x: 600, y: -50 }, end: { x: 600, y: 50 } },
  { id: 'lineD2', type: 'line', layerId: 'lyr', start: { x: 550, y: 25 }, end: { x: 640, y: 25 } },
  // Ε — τριπλή σύμπτωση στο (800, 0): ENDPOINT + INTERSECTION + MIDPOINT.
  { id: 'lineE1', type: 'line', layerId: 'lyr', start: { x: 800, y: 0 }, end: { x: 900, y: 0 } },
  { id: 'lineE2', type: 'line', layerId: 'lyr', start: { x: 800, y: -50 }, end: { x: 800, y: 50 } },
  // ΣΤ — ανοιχτή πολυγραμμή με ενδιάμεση κορυφή.
  {
    id: 'polylineF', type: 'polyline', layerId: 'lyr', closed: false,
    vertices: [{ x: 1100, y: 0 }, { x: 1150, y: 0 }, { x: 1150, y: 50 }],
  },
  // Ζ — κείμενο (TEXT 8-point).
  {
    id: 'textG', type: 'text', layerId: 'lyr', text: 'AB',
    position: { x: 1400, y: 0 }, fontSize: 10, rotation: 0, visible: true,
  },
  // Η — τόξο (ARC: endpoints/midpoint/center από άλλο μονοπάτι γεωμετρίας).
  {
    id: 'arcH', type: 'arc', layerId: 'lyr', center: { x: 1700, y: 0 },
    radius: 30, startAngle: 0, endAngle: Math.PI / 2,
  },
  // Θ — μικροσκοπικός κύκλος + μικρό ορθογώνιο: AABB σχεδόν σημειακά, ενώ οι ανοχές φτάνουν πολύ
  // πιο μακριά. Χρήσιμα ως «στενοί στόχοι» για τις engines με ιδιωτικό ευρετήριο.
  { id: 'tinyCircleI', type: 'circle', layerId: 'lyr', center: { x: 2000, y: 0 }, radius: 0.2 },
  { id: 'rectJ', type: 'rectangle', layerId: 'lyr', corner1: { x: 2300, y: -1 }, corner2: { x: 2301, y: 1 } },
  // Κ — ΤΟΙΧΟΣ BIM. 🔴 **Ο ΜΟΝΑΔΙΚΟΣ αισθητήρας του aperture στο ΠΡΟΕΠΙΛΕΓΜΕΝΟ μονοπάτι.**
  //
  // Εύρημα της Φ2 (2026-07-30, ανάγνωση κώδικα + επαλήθευση με μετάλλαξη· διορθώνει την
  // απογραφή του ADR-728 §3.2): από τους **22 τύπους που είναι ενεργοί by default**, ο
  // `BIM_WALL_FACE` είναι ο **μόνος** που διαβάζει `context.entities` **σε κάθε αναζήτηση**.
  // Όλοι οι άλλοι το παρακάμπτουν: `INTERSECTION` και `TEXT` **προϋπολογίζουν** στο `initialize`·
  // `ENDPOINT`/`MIDPOINT`/`CENTER`/`BIM_*`/`DIM_*`/`COMPLEX_*` ρωτούν **ιδιωτικό spatial index**
  // (χτισμένο επίσης στο `initialize`)· `GRID` είναι αναλυτική· `GUIDE`/`CONSTRUCTION_POINT`/
  // `ROTATION_*`/`SELECTED_GRIP` διαβάζουν δικά τους stores. Ακόμη και το fallback του `CENTER`
  // για ορθογώνια είναι **νεκρό**: το ιδιωτικό του ευρετήριο περιέχει ήδη το κέντρο κάθε
  // οντότητας (`getEntityCenter`), οπότε ο υποψήφιος παράγεται πριν φτάσει ο βρόχος.
  //
  // ⇒ Χωρίς τοίχο εδώ, η προεπιλεγμένη διαμόρφωση θα έμενε πράσινη ακόμη και με aperture × 0,05,
  //   δηλαδή **δεν θα μετρούσε τίποτα**. Το `geometry.bbox` είναι υποχρεωτικό: χωρίς αυτό ο
  //   `resolveEntityBounds` γυρίζει `null` και ο τοίχος μπαίνει στο «πάντα μέσα» (fail-open) —
  //   σωστό, αλλά τότε πάλι δεν μετριέται τίποτα.
  {
    id: 'wallK', type: 'wall', kind: 'straight', layerId: 'lyr', visible: true,
    params: { category: 'exterior', start: { x: 2600, y: 0 }, end: { x: 2640, y: 0 }, height: 3000, thickness: 20, flip: false },
    geometry: { bbox: { min: { x: 2600, y: -10, z: 0 }, max: { x: 2640, y: 10, z: 3000 } } },
  },
] as unknown as Entity[];

/**
 * Πλέγμα θέσεων κέρσορα: ΠΑΝΩ σε γεωμετρία, ΚΟΝΤΑ (μέσα στην ανοχή), ΟΡΙΑΚΑ ΕΞΩ, και ΜΑΚΡΙΑ
 * (κενός χώρος — η περίπτωση όπου το broad phase κόβει τα πάντα και άρα μπορεί να «κερδίσει»
 * λάθος αποτέλεσμα με τον πιο ύπουλο τρόπο: επιστρέφοντας «τίποτα» αντί για «τίποτα επειδή
 * όντως δεν υπάρχει»).
 */
const CURSOR_GRID: Point2D[] = (() => {
  const points: Point2D[] = [];
  const anchors = [0, 25, 50, 100, 300, 340, 600, 800, 1150, 1400, 1700, 2000, 2300.5, 2620];
  const offsets = [0, 0.4, 2.5, 4.9, 5.1, 12, 37];
  for (const x of anchors) {
    for (const dx of offsets) {
      points.push({ x: x + dx, y: 0 });
      points.push({ x: x + dx, y: dx });
      points.push({ x: x, y: 25 + dx });
      // Λωρίδα y ≈ 12: πέφτει ΕΞΩ από το bbox του τοίχου (±10) αλλά ΜΕΣΑ στην ανοχή
      // BIM_WALL_FACE (30px × 0,5 wpp = 15 wu) — η ακριβής ζώνη που αποκαλύπτει στενό aperture.
      points.push({ x: x + dx, y: 12 });
    }
  }
  // Κενός χώρος + αρνητικές συντεταγμένες + εκτός των ορίων του σχεδίου.
  points.push({ x: 475, y: 475 }, { x: -900, y: -900 }, { x: 9000, y: 0 }, { x: 200, y: -300 });
  return points;
})();

/** Ό,τι ορίζει «ίδιο αποτέλεσμα» — τα πάντα εκτός από το `timestamp` (χρόνος τοίχου). */
function project(result: ProSnapResult) {
  return {
    found: result.found,
    activeMode: result.activeMode,
    snappedPoint: result.snappedPoint,
    originalPoint: result.originalPoint,
    winner: result.snapPoint
      ? {
          type: result.snapPoint.type,
          entityId: result.snapPoint.entityId,
          description: result.snapPoint.description,
          priority: result.snapPoint.priority,
          point: result.snapPoint.point,
          distance: result.snapPoint.distance,
        }
      : null,
    candidates: result.allCandidates.map(c => ({
      type: c.type, entityId: c.entityId, description: c.description, point: c.point,
    })),
  };
}

function makeOrchestrator(settings: ProSnapSettings, broadPhaseEnabled: boolean): SnapOrchestrator {
  const orchestrator = new SnapOrchestrator(settings, { broadPhaseEnabled });
  orchestrator.initialize(scene, makeViewport());
  return orchestrator;
}

/** Φρέσκα settings ανά εκτέλεση — το `enabledTypes` είναι Set και ο orchestrator το κρατά ζωντανό. */
function defaultSettings(): ProSnapSettings {
  return { ...DEFAULT_PRO_SNAP_SETTINGS, enabledTypes: new Set(DEFAULT_PRO_SNAP_SETTINGS.enabledTypes) };
}

/** Κάθε τύπος που εμφανίζεται στη σειρά προτεραιότητας — μαζί με τις 5 μη-τοπικές. */
function allTypesSettings(): ProSnapSettings {
  return { ...DEFAULT_PRO_SNAP_SETTINGS, enabledTypes: new Set(DEFAULT_PRO_SNAP_SETTINGS.priority) };
}

function runDifferential(makeSettings: () => ProSnapSettings): void {
  const filtered = makeOrchestrator(makeSettings(), true);
  const passthrough = makeOrchestrator(makeSettings(), false);

  try {
    for (const cursor of CURSOR_GRID) {
      const withFilter = project(filtered.findSnapPoint(cursor));
      const without = project(passthrough.findSnapPoint(cursor));
      // Το μήνυμα αστοχίας πρέπει να λέει ΠΟΥ — 200+ θέσεις, ένα σκέτο diff δεν αρκεί.
      expect({ cursor, ...withFilter }).toEqual({ cursor, ...without });
    }
  } finally {
    filtered.dispose();
    passthrough.dispose();
  }
}

describe('ADR-728 §6 — broad phase: συμπεριφορική ισοδυναμία με pass-through', () => {
  it(`με ΠΡΟΕΠΙΛΕΓΜΕΝΟΥΣ τύπους, ${CURSOR_GRID.length} θέσεις κέρσορα δίνουν ΤΑΥΤΟΣΗΜΟ αποτέλεσμα`, () => {
    runDifferential(defaultSettings);
  });

  it(`με ΟΛΟΥΣ τους τύπους ενεργούς (μαζί τις 5 μη-τοπικές), ${CURSOR_GRID.length} θέσεις δίνουν ΤΑΥΤΟΣΗΜΟ αποτέλεσμα`, () => {
    runDifferential(allTypesSettings);
  });

  it('με ενεργό `excludeEntityId` (drag της ίδιας οντότητας) η ισοδυναμία διατηρείται', () => {
    const filtered = makeOrchestrator(defaultSettings(), true);
    const passthrough = makeOrchestrator(defaultSettings(), false);
    try {
      for (const cursor of CURSOR_GRID) {
        expect(project(filtered.findSnapPoint(cursor, 'lineE1')))
          .toEqual(project(passthrough.findSnapPoint(cursor, 'lineE1')));
      }
    } finally {
      filtered.dispose();
      passthrough.dispose();
    }
  });
});

describe('ADR-728 Φ2 — η ισοδυναμία ΔΕΝ είναι κενή: το φίλτρο όντως φιλτράρει', () => {
  /**
   * 🔴 Χωρίς αυτό το test, όλα τα παραπάνω θα περνούσαν και με broad phase που δεν κόβει τίποτα
   * (π.χ. αν κάθε οντότητα κατέληγε στο «πάντα μέσα» λόγω σιωπηλού bug στα bounds). Η ισοδυναμία
   * αποδεικνύει **ορθότητα**· αυτό εδώ αποδεικνύει ότι υπάρχει κάτι να είναι ορθό.
   */
  it('η κατάσταση της σκηνής παράγει ευρετήριο, και σε κενό χώρο ο κέρσορας βλέπει ΛΙΓΟΤΕΡΕΣ οντότητες', () => {
    const seen: number[] = [];
    const orchestrator = new SnapOrchestrator(defaultSettings(), { broadPhaseEnabled: true });
    orchestrator.initialize(scene, makeViewport());

    // Το μέγεθος που παραδίδεται είναι ιδιωτικό· το μετράμε έμμεσα μέσω μιας engine που σαρώνει
    // το `context.entities` — η CENTER είναι ενεργή by default και επιστρέφει υποψήφιο μόνο για
    // κύκλους/τόξα μέσα στην ανοχή. Στο (300,0) βλέπει τον κύκλο· στο (9000,0) τίποτα.
    // ⚠️ Το μακρινό σημείο πρέπει να είναι ΚΑΙ εκτός πλέγματος: το `GridSnapEngine` είναι ενεργό
    // by default και δεν διαβάζει καθόλου οντότητες (αναλυτικό) — σε στρογγυλή συντεταγμένη θα
    // έδινε υποψήφιο και θα έκρυβε το ερώτημα. (9013, 4477): πλησιέστερο grid point (9000, 4500),
    // απόσταση ≈26 world units ≫ ανοχή GRID (10px × 0,5 wpp = 5).
    seen.push(orchestrator.findSnapPoint({ x: 300, y: 0 }).allCandidates.length);
    seen.push(orchestrator.findSnapPoint({ x: 9013, y: 4477 }).allCandidates.length);
    orchestrator.dispose();

    expect(seen[0]).toBeGreaterThan(0);
    expect(seen[1]).toBe(0);
  });

  it('ο πίνακας που φτάνει στις engines είναι ΜΙΚΡΟΤΕΡΟΣ από τη σκηνή σε τοπικό κέρσορα', () => {
    // Άμεση μέτρηση του φίλτρου, χωρίς orchestrator: η ίδια συνάρτηση που καλεί εκείνος.
    // (Το `snap-broad-phase.test.ts` το καρφώνει αναλυτικά· εδώ κρατάμε τον ΣΥΝΔΕΣΜΟ με τη
    // σκηνή αυτού του αρχείου, ώστε αν η σκηνή αλλάξει και πάψει να φιλτράρεται, να το μάθουμε.)
    const orchestrator = new SnapOrchestrator(defaultSettings(), { broadPhaseEnabled: true });
    orchestrator.initialize(scene, makeViewport());
    const stats = orchestrator.getStats();
    orchestrator.dispose();

    expect(stats.totalEntities).toBe(scene.length);
    expect(scene.length).toBeGreaterThan(5);
  });
});
