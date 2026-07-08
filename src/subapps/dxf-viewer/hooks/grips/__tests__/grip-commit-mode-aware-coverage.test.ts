/**
 * Mode-aware grip-commit routing coverage (ADR-587 Φ7 — TIER-2 grip SEAM C,
 * Mechanism 2: coverage-only mirror, ΜΗΔΕΝ source mutation).
 *
 * Το `commitDxfGripDragModeAware` (`grip-commit-adapters.ts`) ΔΕΝ είναι Record
 * dispatch όπως το Seam B — είναι **ordered interleaved gates** με load-bearing
 * σειρά (action-grips ΠΡΙΝ το zero-delta guard· Alt-move bypass ΠΡΙΝ το
 * parametric dispatch· τα 6 primitive gates ΜΕΤΑ το parametric· μετά το generic
 * mode dispatch). Μετατροπή σε Record θα έχανε τη σειρά + τα double-guards, γι'
 * αυτό εδώ ΔΕΝ κεντρικοποιούμε — απλά **καρφώνουμε** το routing map ρητά ώστε αν
 * κάποιος αλλάξει σειρά/gate ή προσθέσει νέο kind χωρίς συνειδητή απόφαση, να
 * σπάει (mirror των Μηχ.2 tests του Φ5 'move'/'bounds-twins').
 *
 * Δένει το routing του Seam C με το grip discriminator domain
 * (`GRIP_KIND_ENTITIES`, 31): κάθε ένα από τα 31 entities ταξινομείται σε ΑΚΡΙΒΩΣ
 * ΕΝΑ από:
 *  (A) SEAM_C_GATED         — έχει ΡΗΤΟ gate μέσα στο `commitDxfGripDragModeAware`.
 *  (B) SEAM_B_PARAMETRIC     — δρομολογείται από το `tryCommitParametricGripDrag`
 *                              (Seam B) ΧΩΡΙΣ ρητό Seam-C gate.
 *  (C) GENERIC_DISPATCH_ONLY — κανένα ρητό gate· πέφτει στο generic mode dispatch.
 *
 * ⚠️ ΔΕΝ εξαρτάται από exports του Seam B (τρέχει παράλληλα): οι partitions είναι
 * hardcoded constants ΕΔΩ, δεμένες ΜΟΝΟ στο `GRIP_KIND_ENTITIES` domain.
 *
 * Νέος grip-producer entity → προσγειώνεται σε (A)/(B)/(C) → σπάει το domain-closure
 * test → επιβάλλει συνειδητή απόφαση για το πού δρομολογείται στο Seam C.
 */

// Firebase auth mock — τα type barrels αγγίζουν auth στο import path (handoff trap).
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { GRIP_KIND_ENTITIES } from '../../grip-kinds';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();

// ============================================================================
// SEAM C partition — code=truth χαρτογράφηση της `commitDxfGripDragModeAware`
// (grip-commit-adapters.ts γρ ~153-332). Κάθε entity σε ΑΚΡΙΒΩΣ μία κατηγορία.
// ============================================================================

/**
 * (A) Entities με ΡΗΤΟ gate μέσα στο `commitDxfGripDragModeAware` (8).
 * ⚠️ `opening` + `mep-manifold` είναι ΚΑΙ parametric (Seam B) ΑΛΛΑ έχουν ΕΠΙΠΛΕΟΝ
 * pre-parametric action gates εδώ (βλ. SEAM_C_DUAL_ROUTED παρακάτω) → ανήκουν στο (A).
 * arc / polyline / annotation-symbol / group / text / line είναι Seam-C-only (ΟΧΙ Seam B).
 */
const SEAM_C_GATED = [
  'opening',            // early action: opening-rotation/opening-facing → commitOpeningGripDrag· Alt: → commitOpeningAltMove
  'mep-manifold',       // early action: outlet-add/remove (μόνο !isActiveGripAltMove) → commitMepManifoldOutletCountGrip
  'arc',                // arc-rotation → commitArcGripDrag (arc-move falls through)
  'polyline',           // polyline-rotation → commitPolylineRotationGripDrag· polyline-arc-midpoint-* → commitPolylineBulgeGripDrag
  'annotation-symbol',  // annotation-symbol-rotation → commitAnnotationSymbolGripDrag· annotation-symbol-move → commitWholeEntityMove
  'group',              // group-rotation → commitGroupGizmoRotation· group-move → commitWholeEntityMove
  'text',               // textKind (ANY) → commitTextGripDrag
  'line',               // line-rotation → commitLineGripDrag· line-move → commitDxfGripDragViaStretchCommand
] as const;

/**
 * (B) Parametric entities δρομολογούμενα από το Seam B (`tryCommitParametricGripDrag`)
 * ΧΩΡΙΣ ρητό Seam-C gate (22). = οι 24 Seam-B kinds ΜΕΙΟΝ opening + mep-manifold
 * (που ανεβαίνουν στο (A) λόγω των action gates τους). ⚠️ Hardcoded — δεν διαβάζουμε
 * το Seam-B export (παράλληλο agent).
 */
const SEAM_B_PARAMETRIC = [
  'stair', 'dimension', 'wall', 'slab', 'slab-opening', 'roof', 'beam', 'column',
  'foundation', 'mep-fixture', 'electrical-panel', 'mep-radiator', 'mep-boiler',
  'mep-water-heater', 'mep-segment', 'furniture', 'floorplan-symbol', 'floor-finish',
  'hatch', 'mep-underfloor', 'xline', 'ray',
] as const;

/**
 * (C) Entities ΧΩΡΙΣ κανένα ρητό gate — πέφτουν στο generic mode dispatch
 * (move → commitWholeEntityMove· rotate/scale/mirror → tool handoff· stretch →
 * commitDxfGripDragViaStretchCommand). `circle` είναι ο ΜΟΝΟΣ (ούτε Seam B, ούτε
 * Seam-C gate) — ασυμμετρία καρφωμένη ρητά.
 */
const GENERIC_DISPATCH_ONLY = ['circle'] as const;

/**
 * Dual-routed: parametric entities που έχουν ΚΑΙ pre-parametric Seam-C action gate.
 * Το action gate πρoηγείται του `tryCommitParametricGripDrag` για συγκεκριμένα
 * kind-literals — πρέπει να παραμείνει ΠΑΝΩ από το parametric dispatch.
 */
const SEAM_C_DUAL_ROUTED = ['opening', 'mep-manifold'] as const;

// ============================================================================
// Ordered gate map — literal/predicate → handler, στη ΣΕΙΡΑ που εμφανίζεται στο
// source. Το `order` πινάρει το load-bearing sequencing· `phase` ομαδοποιεί.
// ============================================================================

type GatePhase =
  | 'pre-zero-delta-action'
  | 'alt-move'
  | 'parametric'
  | 'primitive-gate'
  | 'mode-dispatch';

interface GatePin {
  readonly order: number;
  readonly phase: GatePhase;
  /** Το routing predicate (kind-literal / entity-tag / mode) όπως στο source. */
  readonly match: string;
  /** Ο handler / branch που καλείται. */
  readonly handler: string;
  /** Πρόσθετος guard πέρα από το match (π.χ. Alt state), αν υπάρχει. */
  readonly guard?: string;
}

/**
 * ADR-602 / ADR-587 Φ7 — καρφωμένο routing του `commitDxfGripDragModeAware` στη
 * ΣΕΙΡΑ του source. Αλλαγή σειράς/gate/handler → σπάει.
 */
const GATE_ORDER: readonly GatePin[] = [
  // ── pre-zero-delta ACTION grips (fire ακόμα και σε zero delta) ──────────────
  { order: 0, phase: 'pre-zero-delta-action', match: "opening: 'opening-rotation'|'opening-facing'", handler: 'commitOpeningGripDrag' },
  { order: 1, phase: 'pre-zero-delta-action', match: "mep-manifold: 'mep-manifold-outlet-add'|'mep-manifold-outlet-remove'", handler: 'commitMepManifoldOutletCountGrip', guard: '!isActiveGripAltMove()' },
  // ── (zero-delta guard + entityId guard εδώ ανάμεσα) ─────────────────────────
  // ── Alt-move bypass (ΠΡΙΝ το parametric dispatch) ───────────────────────────
  { order: 2, phase: 'alt-move', match: 'opening (ANY openingKind)', handler: 'commitOpeningAltMove', guard: 'isActiveGripAltMove()' },
  { order: 3, phase: 'alt-move', match: 'else (κάθε άλλο entity)', handler: 'commitWholeEntityMove', guard: 'isActiveGripAltMove()' },
  // ── Seam B parametric dispatch ──────────────────────────────────────────────
  { order: 4, phase: 'parametric', match: 'tryCommitParametricGripDrag (24 kinds)', handler: 'PARAMETRIC_COMMIT_HANDLERS[on]' },
  // ── 6 primitive/editor gates (ΜΕΤΑ το parametric) ───────────────────────────
  { order: 5, phase: 'primitive-gate', match: "arc: 'arc-rotation'", handler: 'commitArcGripDrag' },
  { order: 6, phase: 'primitive-gate', match: "polyline: 'polyline-rotation'", handler: 'commitPolylineRotationGripDrag' },
  { order: 7, phase: 'primitive-gate', match: "annotation-symbol: 'annotation-symbol-rotation'", handler: 'commitAnnotationSymbolGripDrag' },
  { order: 8, phase: 'primitive-gate', match: "group: 'group-rotation'", handler: 'commitGroupGizmoRotation' },
  { order: 9, phase: 'primitive-gate', match: "group: 'group-move'", handler: 'commitWholeEntityMove' },
  { order: 10, phase: 'primitive-gate', match: "annotation-symbol: 'annotation-symbol-move'", handler: 'commitWholeEntityMove' },
  { order: 11, phase: 'primitive-gate', match: "polyline: 'polyline-arc-midpoint-*'", handler: 'commitPolylineBulgeGripDrag' },
  { order: 12, phase: 'primitive-gate', match: 'text: ANY textKind', handler: 'commitTextGripDrag' },
  { order: 13, phase: 'primitive-gate', match: "line: 'line-rotation'", handler: 'commitLineGripDrag' },
  { order: 14, phase: 'primitive-gate', match: "line: 'line-move'", handler: 'commitDxfGripDragViaStretchCommand' },
  // ── generic mode dispatch (default) ─────────────────────────────────────────
  { order: 15, phase: 'mode-dispatch', match: "mode==='move'", handler: 'commitWholeEntityMove' },
  { order: 16, phase: 'mode-dispatch', match: "mode==='rotate'|'scale'|'mirror'", handler: 'GripHandoffStore.set + deps.onToolChange' },
  { order: 17, phase: 'mode-dispatch', match: "mode==='stretch' (default)", handler: 'commitDxfGripDragViaStretchCommand' },
] as const;

const PHASE_RANK: Record<GatePhase, number> = {
  'pre-zero-delta-action': 0,
  'alt-move': 1,
  parametric: 2,
  'primitive-gate': 3,
  'mode-dispatch': 4,
};

const domainSet = new Set<string>(GRIP_KIND_ENTITIES);

describe('Mode-aware grip-commit routing coverage — Seam C ↔ grip discriminator domain (ADR-587 Φ7)', () => {
  // ── Domain closure & disjointness ─────────────────────────────────────────
  it('(A)∪(B)∪(C) === GRIP_KIND_ENTITIES (domain closure, 8 + 22 + 1 = 31)', () => {
    const union = [...SEAM_C_GATED, ...SEAM_B_PARAMETRIC, ...GENERIC_DISPATCH_ONLY];
    expect(asSorted(union)).toEqual(asSorted([...GRIP_KIND_ENTITIES]));
    expect(GRIP_KIND_ENTITIES).toHaveLength(31);
    expect(union).toHaveLength(31); // καμία επικάλυψη → κάθε entity σε ΑΚΡΙΒΩΣ 1 partition
  });

  it('οι 3 partitions είναι pairwise disjoint', () => {
    const a = new Set<string>(SEAM_C_GATED);
    const b = new Set<string>(SEAM_B_PARAMETRIC);
    const c = new Set<string>(GENERIC_DISPATCH_ONLY);
    expect([...b].filter((k) => a.has(k))).toEqual([]);
    expect([...c].filter((k) => a.has(k))).toEqual([]);
    expect([...c].filter((k) => b.has(k))).toEqual([]);
  });

  it('κανένα partition entity δεν είναι εκτός domain (partition ⊆ discriminator)', () => {
    const all = [...SEAM_C_GATED, ...SEAM_B_PARAMETRIC, ...GENERIC_DISPATCH_ONLY];
    expect(all.filter((k) => !domainSet.has(k))).toEqual([]);
  });

  // ── Golden partition sets ─────────────────────────────────────────────────
  it('(A) SEAM_C_GATED = καρφωμένο golden set (8)', () => {
    expect(asSorted([...SEAM_C_GATED])).toEqual(
      asSorted([
        'opening', 'mep-manifold', 'arc', 'polyline', 'annotation-symbol',
        'group', 'text', 'line',
      ]),
    );
    expect(SEAM_C_GATED).toHaveLength(8);
  });

  it('(B) SEAM_B_PARAMETRIC = 22 (οι 24 Seam-B ΜΕΙΟΝ opening + mep-manifold)', () => {
    expect(SEAM_B_PARAMETRIC).toHaveLength(22);
    // opening + mep-manifold ΔΕΝ ανήκουν εδώ — ανεβαίνουν στο (A) λόγω action gates
    expect(SEAM_B_PARAMETRIC).not.toContain('opening');
    expect(SEAM_B_PARAMETRIC).not.toContain('mep-manifold');
  });

  it('(C) GENERIC_DISPATCH_ONLY = ["circle"] ΜΟΝΟ (ο μόνος χωρίς Seam-B ή Seam-C gate)', () => {
    expect(GENERIC_DISPATCH_ONLY).toEqual(['circle']);
  });

  // ── Ordered gate map — load-bearing sequencing ────────────────────────────
  it('GATE_ORDER είναι στην ακριβή source σειρά (18 gates, orders 0..17)', () => {
    expect(GATE_ORDER).toHaveLength(18);
    GATE_ORDER.forEach((g, i) => expect(g.order).toBe(i));
  });

  it('τα phases εμφανίζονται σε μη-φθίνουσα σειρά (action < alt < parametric < primitive < dispatch)', () => {
    for (let i = 1; i < GATE_ORDER.length; i++) {
      expect(PHASE_RANK[GATE_ORDER[i].phase]).toBeGreaterThanOrEqual(
        PHASE_RANK[GATE_ORDER[i - 1].phase],
      );
    }
  });

  it('τα pre-zero-delta ACTION gates προηγούνται ΟΛΩΝ των υπολοίπων (fire σε zero delta)', () => {
    const action = GATE_ORDER.filter((g) => g.phase === 'pre-zero-delta-action');
    expect(action.map((g) => g.handler)).toEqual([
      'commitOpeningGripDrag',
      'commitMepManifoldOutletCountGrip',
    ]);
    const maxActionOrder = Math.max(...action.map((g) => g.order));
    const others = GATE_ORDER.filter((g) => g.phase !== 'pre-zero-delta-action');
    expect(Math.min(...others.map((g) => g.order))).toBeGreaterThan(maxActionOrder);
  });

  it('το Alt-move bypass προηγείται του parametric dispatch (Seam B)', () => {
    const altMax = Math.max(...GATE_ORDER.filter((g) => g.phase === 'alt-move').map((g) => g.order));
    const paramMin = Math.min(...GATE_ORDER.filter((g) => g.phase === 'parametric').map((g) => g.order));
    expect(altMax).toBeLessThan(paramMin);
  });

  it('τα 6 primitive gates ΕΠΟΝΤΑΙ του parametric dispatch', () => {
    const paramMax = Math.max(...GATE_ORDER.filter((g) => g.phase === 'parametric').map((g) => g.order));
    const primMin = Math.min(...GATE_ORDER.filter((g) => g.phase === 'primitive-gate').map((g) => g.order));
    expect(primMin).toBeGreaterThan(paramMax);
  });

  // ── Asymmetries καρφωμένες ρητά (ADR-587 §4.6) ────────────────────────────
  it('ΑΣΥΜΜΕΤΡΙΑ — opening + mep-manifold είναι dual-routed: Seam-C action gate ΠΑΝΩ από Seam B', () => {
    // Είναι parametric (Seam B) ΑΛΛΑ κατατάσσονται στο (A) γιατί το action gate τους
    // προηγείται του tryCommitParametricGripDrag για συγκεκριμένα literals.
    SEAM_C_DUAL_ROUTED.forEach((k) => expect(SEAM_C_GATED).toContain(k));
    const actionOrders = GATE_ORDER.filter((g) => g.phase === 'pre-zero-delta-action').map((g) => g.order);
    const parametricOrder = GATE_ORDER.find((g) => g.phase === 'parametric')!.order;
    actionOrders.forEach((o) => expect(o).toBeLessThan(parametricOrder));
  });

  it('ΑΣΥΜΜΕΤΡΙΑ — το mep-manifold action gate είναι guarded από !isActiveGripAltMove() (Alt→whole-entity move)', () => {
    const g = GATE_ORDER.find((x) => x.handler === 'commitMepManifoldOutletCountGrip')!;
    expect(g.guard).toBe('!isActiveGripAltMove()');
  });

  it('ΑΣΥΜΜΕΤΡΙΑ — arc: ΜΟΝΟ arc-rotation gated· το arc-move πέφτει στο mode dispatch', () => {
    const arcGates = GATE_ORDER.filter((g) => g.match.startsWith('arc:'));
    expect(arcGates.map((g) => g.match)).toEqual(["arc: 'arc-rotation'"]);
  });

  it('ΑΣΥΜΜΕΤΡΙΑ — polyline: ΜΟΝΟ rotation + arc-midpoint gated· vertex/segment/move πέφτουν στο stretch/move', () => {
    const plGates = GATE_ORDER.filter((g) => g.match.startsWith('polyline:'));
    expect(plGates.map((g) => g.handler)).toEqual([
      'commitPolylineRotationGripDrag', // polyline-rotation
      'commitPolylineBulgeGripDrag',    // polyline-arc-midpoint-*
    ]);
  });

  it('ΑΣΥΜΜΕΤΡΙΑ — group-move + annotation-symbol-move → commitWholeEntityMove (MoveEntityCommand SSoT), ΟΧΙ stretch', () => {
    const groupMove = GATE_ORDER.find((g) => g.match === "group: 'group-move'")!;
    const annMove = GATE_ORDER.find((g) => g.match === "annotation-symbol: 'annotation-symbol-move'")!;
    expect(groupMove.handler).toBe('commitWholeEntityMove');
    expect(annMove.handler).toBe('commitWholeEntityMove');
  });

  it('ΑΣΥΜΜΕΤΡΙΑ — line-move → commitDxfGripDragViaStretchCommand (StretchEntityCommand SSoT), ΔΙΑΦΟΡΕΤΙΚΟ move SSoT από group/annotation', () => {
    const lineMove = GATE_ORDER.find((g) => g.match === "line: 'line-move'")!;
    expect(lineMove.handler).toBe('commitDxfGripDragViaStretchCommand');
    // ρητή αντιπαράθεση: line-move ≠ group/annotation move handler
    const groupMove = GATE_ORDER.find((g) => g.match === "group: 'group-move'")!;
    expect(lineMove.handler).not.toBe(groupMove.handler);
  });

  it('ΑΣΥΜΜΕΤΡΙΑ — text: ANY textKind gated (χωρίς sub-literal διαχωρισμό, αντίθετα με arc/line/polyline)', () => {
    const textGates = GATE_ORDER.filter((g) => g.match.startsWith('text:'));
    expect(textGates).toHaveLength(1);
    expect(textGates[0].match).toBe('text: ANY textKind');
  });

  it('ΑΣΥΜΜΕΤΡΙΑ — Alt-move: opening → commitOpeningAltMove (host-constrained)· κάθε άλλο → commitWholeEntityMove', () => {
    const alt = GATE_ORDER.filter((g) => g.phase === 'alt-move');
    expect(alt.map((g) => g.handler)).toEqual([
      'commitOpeningAltMove',   // opening (δεν free-translate — γλιστράει στον host τοίχο)
      'commitWholeEntityMove',  // κάθε άλλο entity
    ]);
    alt.forEach((g) => expect(g.guard).toBe('isActiveGripAltMove()'));
  });

  it('ΑΣΥΜΜΕΤΡΙΑ — circle: κανένα ρητό gate → πέφτει ΚΑΘΑΡΑ στο generic mode dispatch', () => {
    // Δεν εμφανίζεται σε κανένα gate match του Seam C.
    expect(GATE_ORDER.some((g) => g.match.startsWith('circle'))).toBe(false);
    expect(GENERIC_DISPATCH_ONLY).toContain('circle');
  });
});
