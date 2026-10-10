/**
 * ADR-909 Γ2.6β — ό,τι φτάνει (ή μπορεί να φτάσει) στο χαρτί **εκτός δείγματος της πύλης pixels**: ο οπλισμός
 * (κολόνα με «δείξε οπλισμό»), η γραμμοσκίαση οπλισμού της πλάκας, η σχάρα της μεταλλικής σκάλας, η βάση του
 * γερμένου τοίχου / κολόνας — και τα δύο overlays που σήμερα δεν τυπώνονται καθόλου (καλώδια, μόνωση), ώστε η
 * στατική πύλη του Γ2.8 να μη χρειαστεί εξαίρεση γι' αυτά.
 *
 * 🔴 Πριν: ωμά `ctx.strokeStyle = '#c0392b'` κ.λπ. ⇒ κολόνα με ορατό οπλισμό έβγαινε **κόκκινη** στην «Ασπρόμαυρη»
 * δημόσια κάτοψη. Η πύλη pixels δεν το έβλεπε: το προεπιλεγμένο δείγμα της δεν έχει οπλισμό.
 *
 * Ζ1 οθόνη όπως πριν (οι σταθερές γραμμένες εδώ ρητά) · Ζ2 δημόσια κάτοψη × στάθμη: πλήρες μελάνι ≥ 3:1, άχρωμο
 * στις άχρωμες, πάχος ≥ δάπεδο · Ζ3 PDF μηχανικού: μαύρο, χωρίς το δάπεδο των 4 px · Ζ4 στο χαρτί ίδιες γραμμές,
 * ίδιες παύλες, `save` = `restore`.
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

import { MIN_ENTITY_CONTRAST } from '../../../config/contrast-adaptation';
import { clearPrintColorPolicy, setPrintColorPolicy } from '../../../config/print-color-policy';
import { buildDefaultFloorFinishParams, buildFloorFinishEntity } from '../../../hooks/drawing/floor-finish-completion';
import { buildDefaultSlabParams, buildSlabEntity } from '../../../hooks/drawing/slab-completion';
import { LAYER_ID, built } from '../../../print/public-floorplan/pixel-gate/pixel-gate-sample-kit';
import type { EntityModel, Point2D, Point3D, ViewTransform } from '../../../rendering/types/Types';
import type { FloorFinishMaterialId } from '../../types/floor-finish-types';
import type { EnvelopeOpeningCut } from '../../geometry/envelope-opening-cuts';
import type { EnvelopeChain } from '../../geometry/envelope-perimeter';
import type { CircuitWirePath } from '../../mep-systems/mep-wire-routing';
import type { RebarPlanGeometry } from '../../structural/reinforcement/rebar-plan-geometry-types';
import type { SlabReinforcement } from '../../types/slab-types';
import { GRAPHITE_EPS_MATERIAL_ID } from '../../types/thermal-envelope-types';
import { drawCutPlaneTiltProjection } from '../cut-plane-tilt-projection';
import { drawRebarPlanGeometry } from '../draw-rebar-plan-geometry';
import { EnvelopeRenderer, buildEnvelopeRenderPlan, buildSlabHatchPlan } from '../EnvelopeRenderer';
import { FloorFinishRenderer } from '../FloorFinishRenderer';
import { drawCircuitWires } from '../MepWireRenderer';
import { SlabRenderer } from '../SlabRenderer';
import { renderTreadsForStructure } from '../stair-render-structure-style';
import { ENGINEER_PDF, FLOOR_PX, PLOT_STYLES, isGrey, isOpaque, onPaper, publicImage } from './print-pass-policies';
import { recordingContext, type Painted, type PaintedStroke } from './recording-canvas';
import { paintedBy } from './structural-samples';

const identity = (p: Point2D): Point2D => ({ x: p.x, y: p.y });
const RING: Point2D[] = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];
const VIEW: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const VIEWPORT = { width: 800, height: 600 };

/** Ζωγράφισε με σκέτη συνάρτηση σχεδίασης (όχι ζωγράφο οντότητας) σε πλαστό καμβά. */
function drawn(draw: (ctx: CanvasRenderingContext2D) => void): Painted {
  const { ctx, painted } = recordingContext();
  draw(ctx);
  return painted;
}

// Οι σταθερές της οθόνης **όπως ήταν πριν** το Γ2.6β, γραμμένες ρητά: αν ο ζωγράφος τις αλλάξει, κοκκινίζει το Ζ1.
const REBAR_CRIMSON = '#c0392b';
const SLAB_HATCH = 'rgba(0, 0, 0, 0.15)';
const TILT_SLATE = '#5b6478';
const WIRE_RED = '#ff0000';
const INSULATION_HATCH = 'rgba(0, 0, 0, 0.20)';
const INSULATION_FACE = 'rgba(184, 92, 28, 0.95)';

/** Πάχος / παύλα / χρώμα που δίνει ο επιλυτής των Object Styles (Γ2.5 Η3) — δεν είναι σταθερά αυτού του βήματος. */
const RESOLVED = expect.any(Number);
const RESOLVED_DASH = expect.any(Array);
const RESOLVED_INK = expect.any(String);

/** Στεφάνι Ø10 (0,5 px → δάπεδο οθόνης 0,6) · άνω σχάρα Ø20 διακεκομμένη (1 px) · δύο διαμήκεις ράβδοι (κουκκίδες). */
const REBAR: RebarPlanGeometry = {
  paths: [
    { points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }], closed: true, diameterMm: 10 },
    { points: [{ x: 0, y: 200 }, { x: 400, y: 200 }], closed: false, diameterMm: 20, dashed: true },
  ],
  dots: [{ center: { x: 50, y: 50 }, diameterMm: 20 }, { center: { x: 350, y: 350 }, diameterMm: 20 }],
};
const REBAR_PX_PER_MM = 0.05;

const reinforcedSlab = (reinforcement: SlabReinforcement) =>
  built('slab', buildSlabEntity({ ...buildDefaultSlabParams(RING), reinforcement }, LAYER_ID));

/** Πόσα γεμίσματα είναι το **σώμα** της πλάκας (αδιαφανής βάση + poché) — ό,τι ακολουθεί είναι οι τελείες του οπλισμού. */
const slabBodyFillCount = (): number =>
  paintedBy((c) => new SlabRenderer(c), built('slab', buildSlabEntity(buildDefaultSlabParams(RING), LAYER_ID))).fills.length;

const WIRE: CircuitWirePath = {
  systemId: 's1', colorHex: WIRE_RED, points: [{ x: 0, y: 0, zMm: 0 }, { x: 100, y: 0, zMm: 0 }, { x: 100, y: 80, zMm: 0 }],
};

const ENVELOPE_CHAIN: EnvelopeChain = {
  exteriorFaceLoop: { points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }], closed: true },
  insulationOuterLoop: {
    points: [{ x: -100, y: -100 }, { x: 1100, y: -100 }, { x: 1100, y: 1100 }, { x: -100, y: 1100 }], closed: true,
  },
  closed: true, enclosesRegion: true, perimeterM: 4.8, wallIds: ['w1', 'w2', 'w3', 'w4'], columnIds: [],
};
const ENVELOPE_CUT: EnvelopeOpeningCut = {
  edgeIndex: 0, tStart: 0.4, tEnd: 0.6, sillM: 0.9, headM: 2.3,
  bandQuad: [{ x: 400, y: -100, z: 0 }, { x: 600, y: -100, z: 0 }, { x: 600, y: 0, z: 0 }, { x: 400, y: 0, z: 0 }],
};

/** Ζώνη μόνωσης + όψη · γραμμοσκίαση εκτεθειμένης πλάκας · απολήξεις στο άνοιγμα — όλες οι γραμμές του overlay. */
function paintEnvelope(): Painted {
  return drawn((ctx) => {
    const renderer = new EnvelopeRenderer(ctx);
    renderer.render(buildEnvelopeRenderPlan(ENVELOPE_CHAIN, GRAPHITE_EPS_MATERIAL_ID)!, VIEW, VIEWPORT);
    renderer.renderSlabHatch(buildSlabHatchPlan(RING, GRAPHITE_EPS_MATERIAL_ID)!, VIEW, VIEWPORT);
    renderer.strokeOpeningCutCaps([ENVELOPE_CUT], VIEW, VIEWPORT);
  });
}

interface Case {
  readonly paint: () => Painted;
  /** Οι διαδοχικές **διαφορετικές** πένες της οθόνης (20 ίδιες γραμμές γραμμοσκίασης = μία γραμμή εδώ). */
  readonly screen: ReadonlyArray<{ ink: unknown; width: unknown; dash: unknown }>;
  /** Γεμίσματα που είναι **μελάνι** (κουκκίδες, βέλος) και το χρώμα τους στην οθόνη — Θ5. */
  readonly inkFills?: { readonly of: (painted: Painted) => string[]; readonly screen: string };
}

const CASES: Readonly<Record<string, Case>> = {
  'οπλισμός (στεφάνι · άνω σχάρα · κουκκίδες ράβδων)': {
    paint: () => drawn((ctx) => drawRebarPlanGeometry(ctx, REBAR, REBAR_PX_PER_MM, identity)),
    screen: [{ ink: REBAR_CRIMSON, width: 0.6, dash: [] }, { ink: REBAR_CRIMSON, width: 1, dash: [6, 4] }],
    inkFills: { of: (p) => p.fills, screen: REBAR_CRIMSON },
  },
  'πλάκα δύο διευθύνσεων (γραμμοσκίαση οπλισμού · περίγραμμα)': {
    paint: () => paintedBy((c) => new SlabRenderer(c), reinforcedSlab('two-way')),
    screen: [{ ink: SLAB_HATCH, width: 0.5, dash: [] }, { ink: RESOLVED_INK, width: RESOLVED, dash: RESOLVED_DASH }],
  },
  'επίπεδη πλάκα (τελείες οπλισμού · περίγραμμα)': {
    paint: () => paintedBy((c) => new SlabRenderer(c), reinforcedSlab('flat')),
    screen: [{ ink: RESOLVED_INK, width: RESOLVED, dash: RESOLVED_DASH }],
    inkFills: { of: (p) => p.fills.slice(slabBodyFillCount()), screen: SLAB_HATCH },
  },
  'βάση γερμένου στοιχείου (ακμές σύνδεσης · περίγραμμα βάσης)': {
    paint: () => drawn((ctx) => drawCutPlaneTiltProjection(ctx, RING, { dx: 300, dy: 0 }, identity, TILT_SLATE)),
    screen: [{ ink: TILT_SLATE, width: 0.75, dash: [] }],
  },
  'καλώδιο κυκλώματος (γραμμή · σημάδια αγωγών · βέλος)': {
    paint: () => drawn((ctx) => drawCircuitWires(ctx, [WIRE], VIEW, VIEWPORT, null, true)),
    screen: [{ ink: WIRE_RED, width: 1.5, dash: [] }, { ink: WIRE_RED, width: 1, dash: [] }],
    inkFills: { of: (p) => p.fills, screen: WIRE_RED },
  },
  'μόνωση (ζώνη · όψη · πλάκα · απολήξεις)': {
    paint: paintEnvelope,
    screen: [
      { ink: INSULATION_HATCH, width: 0.5, dash: [] }, { ink: INSULATION_FACE, width: 1.2, dash: [] },
      { ink: INSULATION_HATCH, width: 0.5, dash: [] }, { ink: INSULATION_FACE, width: 1.2, dash: [] },
    ],
  },
};

/** Συμπτύσσει διαδοχικές ίδιες πένες — η σειρά και το είδος μένουν, το πλήθος κρίνεται χωριστά (Ζ4). */
function penRuns(strokes: readonly PaintedStroke[]): PaintedStroke[] {
  return strokes.filter((s, i) => i === 0 || JSON.stringify(s) !== JSON.stringify(strokes[i - 1]));
}

afterEach(clearPrintColorPolicy);

describe.each(Object.entries(CASES))('«%s» (ADR-909 Γ2.6β)', (_name, { paint, screen, inkFills }) => {
  const inkOf = (painted: Painted): string[] => [...painted.strokes.map((s) => s.ink), ...(inkFills?.of(painted) ?? [])];

  it('Ζ1 οθόνη όπως πριν: χρώμα, πάχος, παύλα αυτούσια', () => {
    const painted = paint();
    expect(penRuns(painted.strokes)).toStrictEqual(screen);
    if (inkFills !== undefined) {
      expect(inkFills.of(painted).length).toBeGreaterThan(0);
      for (const ink of inkFills.of(painted)) expect(ink).toBe(inkFills.screen);
    }
  });

  it.each(PLOT_STYLES)('Ζ2 🔴 δημόσια κάτοψη «%s»: πλήρες μελάνι ≥ 3:1, πάχος ≥ δάπεδο', (style) => {
    setPrintColorPolicy(publicImage(style));
    const painted = paint();
    expect(painted.strokes.length).toBeGreaterThan(0);
    for (const ink of inkOf(painted)) {
      expect(isOpaque(ink)).toBe(true);
      expect(onPaper(ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
      if (style !== 'colour') expect(isGrey(ink)).toBe(true);
    }
    for (const s of painted.strokes) expect(s.width).toBeGreaterThanOrEqual(FLOOR_PX);
  });

  it('Ζ3 🔴 PDF του μηχανικού «Ασπρόμαυρο»: μαύρο, ≥ 1 px, χωρίς το δάπεδο των 4 px', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    const painted = paint();
    for (const ink of inkOf(painted)) expect(ink).toBe('#000000');
    for (const s of painted.strokes) {
      expect(s.width).toBeGreaterThanOrEqual(1);
      expect(s.width).toBeLessThan(FLOOR_PX);
    }
  });

  it('Ζ4 στο χαρτί: ίδιες γραμμές και παύλες με την οθόνη (κανένα chrome, τίποτα δεν χάνεται), save = restore', () => {
    const live = paint();
    setPrintColorPolicy(publicImage('monochrome'));
    const paper = paint();
    expect(paper.strokes.map((s) => s.dash)).toStrictEqual(live.strokes.map((s) => s.dash));
    expect(paper.fills).toHaveLength(live.fills.length);
    for (const run of [live, paper]) {
      expect(run.saves).toBeGreaterThan(0);
      expect(run.restores).toBe(run.saves);
    }
  });
});

describe('οπλισμός — το πάχος μένει η πραγματική διάμετρος, το δάπεδο μπαίνει μόνο από κάτω (ADR-909 Γ2.6β Θ6)', () => {
  /** Ø16 σε 0,5 px/mm = 8 px: πάνω από κάθε δάπεδο. */
  const THICK: RebarPlanGeometry = {
    paths: [{ points: [{ x: 0, y: 0 }, { x: 400, y: 0 }], closed: false, diameterMm: 16 }], dots: [],
  };
  const widthOf = (): number => drawn((ctx) => drawRebarPlanGeometry(ctx, THICK, 0.5, identity)).strokes[0].width;

  it('οθόνη, δημόσια κάτοψη και PDF μηχανικού: 8 px και στα τρία', () => {
    expect(widthOf()).toBe(8);
    setPrintColorPolicy(publicImage('monochrome'));
    expect(widthOf()).toBe(8);
    setPrintColorPolicy(ENGINEER_PDF);
    expect(widthOf()).toBe(8);
  });
});

describe('σχάρα μεταλλικής σκάλας — μόνο το πάχος είναι δικό της (ADR-909 Γ2.6β)', () => {
  const TREAD: Point3D[] = [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, { x: 100, y: 30, z: 0 }, { x: 0, y: 30, z: 0 }];
  /** Το πάχος του πατήματος το δίνει ο επιλυτής (ήδη στο δάπεδο, Γ2.5 Η3)· εδώ κρίνεται η **σχάρα**, η τελευταία γραμμή. */
  const TREAD_WIDTH_PX = 5;
  const grating = (): PaintedStroke => {
    const painted = drawn((ctx) => renderTreadsForStructure(
      { ctx, worldToScreen: identity, baseLineWidth: TREAD_WIDTH_PX }, 'steel-grating', [TREAD],
    ));
    expect(painted.restores).toBe(painted.saves);
    expect(painted.strokes).toHaveLength(2);
    return painted.strokes[1];
  };

  it('Ζ1 οθόνη όπως πριν: 0,6 px, χωρίς παύλα', () => {
    expect(grating()).toMatchObject({ width: 0.6, dash: [] });
  });

  it.each(PLOT_STYLES)('Ζ2 🔴 δημόσια κάτοψη «%s»: πάχος = δάπεδο', (style) => {
    setPrintColorPolicy(publicImage(style));
    expect(grating().width).toBe(FLOOR_PX);
  });

  it('Ζ3 🔴 PDF του μηχανικού: 1 px, όχι το δάπεδο των 4 px', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    expect(grating().width).toBe(1);
  });
});

describe('μοτίβο πλάκας / δαπέδου — η σχεδίαση πέρασε στο `canvas-hatch-fill`, το αποτέλεσμα ίδιο (ADR-909 Γ2.6β)', () => {
  // Κάνναβος 4000 × 3000 mm από το (0, 0): οριζόντιες = ⌊3000 / βήμα⌋ + 1, κάθετες = ⌊4000 / βήμα⌋ + 1.
  const floorFinish = (materialId: FloorFinishMaterialId) =>
    built('floor-finish', buildFloorFinishEntity(buildDefaultFloorFinishParams(RING, { materialId }), LAYER_ID));
  const slabPainter = (c: CanvasRenderingContext2D) => new SlabRenderer(c);
  const floorPainter = (c: CanvasRenderingContext2D) => new FloorFinishRenderer(c);
  const hatchLines = (painted: Painted): number => painted.strokes.filter((s) => s.ink === SLAB_HATCH).length;

  it.each([
    ['one-way', 16], ['two-way', 11 + 14], ['waffle', 21 + 27],
  ] as const)('πλάκα «%s»: %d γραμμές', (reinforcement, lines) => {
    expect(hatchLines(paintedBy(slabPainter, reinforcedSlab(reinforcement)))).toBe(lines);
  });

  it.each([
    ['floor-wood-oak', 21], ['floor-tile-ceramic', 11 + 14],
  ] as const)('δάπεδο «%s»: %d γραμμές', (materialId, lines) => {
    expect(hatchLines(paintedBy(floorPainter, floorFinish(materialId)))).toBe(lines);
  });

  /** Ακτίνες όλων των τελειών — ο πλαστός καμβάς δεν τις θυμάται, άρα κατάσκοπος στο `arc`. */
  function dotRadii(
    create: (ctx: CanvasRenderingContext2D) => SlabRenderer | FloorFinishRenderer, entity: { readonly id: string },
  ): number[] {
    const { ctx } = recordingContext();
    const arc = jest.spyOn(ctx, 'arc');
    const renderer = create(ctx);
    renderer.setTransform(VIEW);
    renderer.render(entity as unknown as EntityModel, {});
    return arc.mock.calls.map((call) => call[2]);
  }

  it('επίπεδη πλάκα: 17 × 13 τελείες ακτίνας 1 px · μοκέτα: 21 × 16 τελείες ακτίνας 1,5 px', () => {
    const slabDots = dotRadii(slabPainter, reinforcedSlab('flat'));
    expect(slabDots).toHaveLength(17 * 13);
    expect(new Set(slabDots)).toStrictEqual(new Set([1]));
    const carpetDots = dotRadii(floorPainter, floorFinish('floor-carpet'));
    expect(carpetDots).toHaveLength(21 * 16);
    expect(new Set(carpetDots)).toStrictEqual(new Set([1.5]));
  });
});

describe('καλώδιο — η λάμψη hover είναι chrome και μένει ωμή στην οθόνη (ADR-909 Γ2.6β Θ2)', () => {
  it('🔴 χαρτί: το πάχος που αφήνει πίσω του ένα φωτισμένο καλώδιο είναι στο δάπεδο — το επόμενο δεν λεπταίνει', () => {
    setPrintColorPolicy(publicImage('monochrome'));
    const second: CircuitWirePath = { ...WIRE, systemId: 's2' };
    const { strokes } = drawn((ctx) => drawCircuitWires(ctx, [WIRE, second], VIEW, VIEWPORT, WIRE.systemId, true));
    const afterHighlight = strokes.slice(2);
    expect(afterHighlight.length).toBeGreaterThan(1);
    for (const s of afterHighlight) expect(s.width).toBeGreaterThanOrEqual(FLOOR_PX);
  });

  it('οθόνη με hover: λάμψη 8 px → πυρήνας 3 px → σημάδια αγωγών 1 px, όλα στο χρώμα του συστήματος', () => {
    const { strokes } = drawn((ctx) => drawCircuitWires(ctx, [WIRE], VIEW, VIEWPORT, WIRE.systemId, true));
    expect(penRuns(strokes)).toStrictEqual([
      { ink: WIRE_RED, width: 8, dash: [] }, { ink: WIRE_RED, width: 3, dash: [] }, { ink: WIRE_RED, width: 1, dash: [] },
    ]);
  });
});
