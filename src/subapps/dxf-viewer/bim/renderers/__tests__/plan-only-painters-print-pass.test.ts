/**
 * ADR-909 Γ2.6α — οι ζωγράφοι που η πύλη pixels (CHECK 3.101) **δεν βλέπει**: στέγη, θεμέλιο, δοκός, επίστρωση
 * δαπέδου, θερμικός χώρος, γραμμή διαχωρισμού χώρου, γενικό στερεό — το προφίλ της δημόσιας κάτοψης τους κρύβει,
 * άρα φτάνουν στο χαρτί **μόνο** από το raster PDF του μηχανικού. Μαζί το φωτιστικό (παραμετρικό σύμβολο), που
 * άλλαξε βασική κλάση, και το `strokePolygonOutline` (όψη «Μόνο κάτοψη»).
 *
 * 🔴 Πριν: ωμά `ctx.strokeStyle = '#a04a2b'` κ.λπ. ⇒ στο «Ασπρόμαυρο» PDF η στέγη έβγαινε καφέ-κόκκινη, ο θερμικός
 * χώρος πετρόλ, η γραμμή διαχωρισμού μοβ. Αυτούς τους κρίνει **μόνο** αυτό το αρχείο — καμία πύλη pixels.
 *
 * Ζ1 οθόνη όπως πριν: χρώμα, πάχος, παύλα αυτούσια (οι σταθερές γραμμένες εδώ ρητά, όχι εισαγμένες από τον
 *    ζωγράφο) · Ζ2 δημόσια κάτοψη × στάθμη: πλήρες μελάνι ≥ 3:1, άχρωμο στις άχρωμες, πάχος ≥ δάπεδο ·
 * Ζ3 PDF μηχανικού: μαύρο, χωρίς το δάπεδο των 4 px · Ζ4 στο χαρτί ίδιες γραμμές, ίδιες παύλες, `save` = `restore`.
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

import { MIN_ENTITY_CONTRAST } from '../../../config/contrast-adaptation';
import { clearPrintColorPolicy, setPrintColorPolicy } from '../../../config/print-color-policy';
import { RENDER_LINE_WIDTHS } from '../../../config/text-rendering-config';
import { buildDefaultFloorFinishParams, buildFloorFinishEntity } from '../../../hooks/drawing/floor-finish-completion';
import { buildDefaultFoundationParams, buildFoundationEntity } from '../../../hooks/drawing/foundation-completion';
import { buildDefaultGenericSolidParams, buildGenericSolidEntity } from '../../../hooks/drawing/generic-solid-completion';
import { PIXEL_GATE_SAMPLES } from '../../../print/public-floorplan/pixel-gate/pixel-gate-samples';
import { LAYER_ID, built, type CellGeometry } from '../../../print/public-floorplan/pixel-gate/pixel-gate-sample-kit';
import { FOUNDATION_KIND_STROKE } from '../../foundations/foundation-render-palette';
import { BeamRenderer } from '../BeamRenderer';
import { strokePolygonOutline } from '../bim-polygon-render';
import { FloorFinishRenderer } from '../FloorFinishRenderer';
import { FoundationRenderer } from '../FoundationRenderer';
import { GenericSolidRenderer } from '../GenericSolidRenderer';
import { MepFixtureRenderer } from '../MepFixtureRenderer';
import { RoofRenderer } from '../RoofRenderer';
import { SpaceSeparatorRenderer } from '../SpaceSeparatorRenderer';
import { ThermalSpaceRenderer } from '../ThermalSpaceRenderer';
import { ENGINEER_PDF, FLOOR_PX, PLOT_STYLES, isGrey, isOpaque, onPaper, publicImage } from './print-pass-policies';
import { recordingContext, type Painted, type PaintedStroke } from './recording-canvas';
import { paintedBy } from './structural-samples';

/** Κελί 3 × 3 m — τα ίδια σημεία αναφοράς που δίνει η πύλη pixels στα εργοστάσιά της. */
const CELL: CellGeometry = {
  centre: { x: 2500, y: 2500 }, from: { x: 1000, y: 2500 }, to: { x: 4000, y: 2500 },
  ring: [{ x: 1000, y: 1000 }, { x: 4000, y: 1000 }, { x: 4000, y: 4000 }, { x: 1000, y: 4000 }],
};

/** Το προεπιλεγμένο δείγμα της πύλης — το **ίδιο** εργοστάσιο παραγωγής, όχι δεύτερο σετ δειγμάτων. */
const gateSample = (type: keyof typeof PIXEL_GATE_SAMPLES) => PIXEL_GATE_SAMPLES[type]!(CELL)[0] as { id: string };

const stripFoundation = () => built('foundation', buildFoundationEntity(
  buildDefaultFoundationParams(CELL.from, 'strip', { axisEnd: { x: CELL.to.x, y: CELL.to.y, z: 0 } }), LAYER_ID,
));
const pyramid = () => built('generic-solid', buildGenericSolidEntity(
  buildDefaultGenericSolidParams(CELL.centre, { shape: { kind: 'pyramid', baseWidthMm: 1000, baseDepthMm: 1000, heightMm: 1000 } }),
  LAYER_ID,
));
const carpet = () => built('floor-finish', buildFloorFinishEntity(
  buildDefaultFloorFinishParams(CELL.ring, { materialId: 'floor-carpet' }), LAYER_ID,
));

/** Πάχος / παύλα που δίνει ο επιλυτής των Object Styles (Γ2.5 Η3) — δεν είναι σταθερά αυτού του βήματος. */
const RESOLVED = expect.any(Number);
const RESOLVED_DASH = expect.any(Array);

// Οι σταθερές της οθόνης **όπως ήταν πριν** το Γ2.6α, γραμμένες ρητά: αν ο ζωγράφος τις αλλάξει, κοκκινίζει το Ζ1.
const ROOF = '#a04a2b';
const ROOF_RIDGE = '#7a3420';
const BEAM_AMBER = '#b07d1f';
const THERMAL_TEAL = '#0d9488';
const SEPARATOR_VIOLET = '#9333ea';
const SOLID_INDIGO = '#7b6cff';
const SOLID_EDGE = 'rgba(123, 108, 255, 0.6)';
const FIXTURE_AMBER = '#d97706';
const FLOOR_OAK = '#E8E0D0';
const FLOOR_HATCH = 'rgba(0, 0, 0, 0.15)';
const CONCRETE_HATCH = 'rgba(0, 0, 0, 0.20)';
const PAD_CROSS = 'rgba(0, 0, 0, 0.45)';

interface Case {
  readonly paint: () => Painted;
  /** Οι διαδοχικές **διαφορετικές** πένες της οθόνης (20 ίδιες γραμμές γραμμοσκίασης = μία γραμμή εδώ). */
  readonly screen: ReadonlyArray<{ ink: string; width: unknown; dash: unknown }>;
  readonly texts?: string;
}

const CASES: Readonly<Record<string, Case>> = {
  'στέγη (γείσο · όψη · κορφιάς)': {
    paint: () => paintedBy((c) => new RoofRenderer(c), gateSample('roof')),
    screen: [{ ink: ROOF, width: 1, dash: [] }, { ink: ROOF, width: 2, dash: [] }, { ink: ROOF_RIDGE, width: 1.5, dash: [6, 4] }],
  },
  'πέδιλο (γραμμοσκίαση · περίγραμμα · σταυρός)': {
    paint: () => paintedBy((c) => new FoundationRenderer(c), gateSample('foundation')),
    screen: [
      { ink: CONCRETE_HATCH, width: 0.5, dash: [] },
      { ink: FOUNDATION_KIND_STROKE.pad, width: RESOLVED, dash: [6, 4] },
      { ink: PAD_CROSS, width: 0.8, dash: [] },
    ],
  },
  'πεδιλοδοκός (γραμμοσκίαση · περίγραμμα · άξονας)': {
    paint: () => paintedBy((c) => new FoundationRenderer(c), stripFoundation()),
    screen: [
      { ink: CONCRETE_HATCH, width: 0.5, dash: [] },
      { ink: FOUNDATION_KIND_STROKE.strip, width: RESOLVED, dash: [6, 4] },
      { ink: FOUNDATION_KIND_STROKE.strip, width: RESOLVED, dash: [12, 3, 3, 3] },
    ],
  },
  'δοκός (περίγραμμα · άξονας)': {
    paint: () => paintedBy((c) => new BeamRenderer(c), gateSample('beam')),
    screen: [{ ink: BEAM_AMBER, width: RESOLVED, dash: RESOLVED_DASH }, { ink: BEAM_AMBER, width: 1, dash: [4, 3] }],
  },
  'επίστρωση δαπέδου (γραμμοσκίαση · περίγραμμα)': {
    paint: () => paintedBy((c) => new FloorFinishRenderer(c), gateSample('floor-finish')),
    screen: [{ ink: FLOOR_HATCH, width: 0.5, dash: [] }, { ink: FLOOR_OAK, width: 1.2, dash: [4, 4] }],
  },
  'θερμικός χώρος (περίγραμμα · ετικέτα)': {
    paint: () => paintedBy((c) => new ThermalSpaceRenderer(c), gateSample('thermal-space')),
    screen: [{ ink: THERMAL_TEAL, width: 1.2, dash: [6, 4] }],
    texts: THERMAL_TEAL,
  },
  'γραμμή διαχωρισμού χώρου': {
    paint: () => paintedBy((c) => new SpaceSeparatorRenderer(c), gateSample('space-separator')),
    screen: [{ ink: SEPARATOR_VIOLET, width: 1.2, dash: [8, 5] }],
  },
  'γενικό στερεό — κουτί': {
    paint: () => paintedBy((c) => new GenericSolidRenderer(c), gateSample('generic-solid')),
    screen: [{ ink: SOLID_INDIGO, width: 2, dash: [] }],
  },
  'γενικό στερεό — πυραμίδα (εσωτερικές ακμές)': {
    paint: () => paintedBy((c) => new GenericSolidRenderer(c), pyramid()),
    screen: [{ ink: SOLID_INDIGO, width: 2, dash: [] }, { ink: SOLID_EDGE, width: 1, dash: [] }],
  },
  'φωτιστικό — παραμετρικό σύμβολο (περίγραμμα + «Χ» με το ίδιο πενάκι)': {
    paint: () => paintedBy((c) => new MepFixtureRenderer(c), gateSample('mep-fixture')),
    screen: [{ ink: FIXTURE_AMBER, width: 2, dash: [] }],
  },
};

/** Συμπτύσσει διαδοχικές ίδιες πένες — η σειρά και το είδος μένουν, το πλήθος κρίνεται χωριστά (Ζ4). */
function penRuns(strokes: readonly PaintedStroke[]): PaintedStroke[] {
  return strokes.filter((s, i) => i === 0 || JSON.stringify(s) !== JSON.stringify(strokes[i - 1]));
}

afterEach(clearPrintColorPolicy);

describe.each(Object.entries(CASES))('«%s» (ADR-909 Γ2.6α)', (_name, { paint, screen, texts }) => {
  it('Ζ1 οθόνη όπως πριν: χρώμα, πάχος, παύλα αυτούσια', () => {
    const painted = paint();
    expect(penRuns(painted.strokes)).toStrictEqual(screen);
    if (texts !== undefined) {
      expect(painted.texts.length).toBeGreaterThan(0);
      for (const ink of painted.texts) expect(ink).toBe(texts);
    }
  });

  it.each(PLOT_STYLES)('Ζ2 🔴 δημόσια κάτοψη «%s»: πλήρες μελάνι ≥ 3:1, πάχος ≥ δάπεδο', (style) => {
    setPrintColorPolicy(publicImage(style));
    const { strokes, texts: inks } = paint();
    expect(strokes.length).toBeGreaterThan(0);
    for (const ink of [...strokes.map((s) => s.ink), ...inks]) {
      expect(isOpaque(ink)).toBe(true);
      expect(onPaper(ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
      if (style !== 'colour') expect(isGrey(ink)).toBe(true);
    }
    for (const s of strokes) expect(s.width).toBeGreaterThanOrEqual(FLOOR_PX);
  });

  it('Ζ3 🔴 PDF του μηχανικού «Ασπρόμαυρο»: μαύρο, ≥ 1 px, χωρίς το δάπεδο των 4 px', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    const { strokes, texts: inks } = paint();
    for (const ink of [...strokes.map((s) => s.ink), ...inks]) expect(ink).toBe('#000000');
    for (const s of strokes) {
      expect(s.width).toBeGreaterThanOrEqual(1);
      expect(s.width).toBeLessThan(FLOOR_PX);
    }
  });

  it('Ζ4 στο χαρτί: ίδιες γραμμές και παύλες με την οθόνη (κανένα chrome, τίποτα δεν χάνεται), save = restore', () => {
    const live = paint();
    setPrintColorPolicy(publicImage('monochrome'));
    const paper = paint();
    expect(paper.strokes.map((s) => s.dash)).toStrictEqual(live.strokes.map((s) => s.dash));
    expect(paper.texts).toHaveLength(live.texts.length);
    expect(paper.fills).toHaveLength(live.fills.length);
    for (const run of [live, paper]) {
      expect(run.saves).toBeGreaterThan(0);
      expect(run.restores).toBe(run.saves);
    }
  });
});

describe('μοκέτα — οι τελείες του μοτίβου είναι μελάνι, όχι γέμισμα (ADR-909 Γ2.6α Θ5)', () => {
  const dots = (): string[] => paintedBy((c) => new FloorFinishRenderer(c), carpet()).fills.slice(1);

  it('Ζ1 οθόνη όπως πριν: αχνές `rgba(0, 0, 0, 0.15)`', () => {
    const inks = dots();
    expect(inks.length).toBeGreaterThan(0);
    for (const ink of inks) expect(ink).toBe(FLOOR_HATCH);
  });

  it.each(PLOT_STYLES)('Ζ2 🔴 δημόσια κάτοψη «%s»: πλήρες άχρωμο μελάνι ≥ 3:1', (style) => {
    setPrintColorPolicy(publicImage(style));
    const inks = dots();
    expect(inks.length).toBeGreaterThan(0);
    for (const ink of inks) {
      expect(isOpaque(ink)).toBe(true);
      expect(isGrey(ink)).toBe(true);
      expect(onPaper(ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
    }
  });
});

describe('strokePolygonOutline — το γυμνό περίγραμμα της όψης «Μόνο κάτοψη» (ADR-909 Γ2.6α)', () => {
  const RING = CELL.ring;
  const SLAB_BLUE = '#1f3a5f';
  const outline = (widthPx?: number): Painted => {
    const { ctx, painted } = recordingContext();
    strokePolygonOutline(ctx, (p) => p, RING, SLAB_BLUE, widthPx);
    return painted;
  };

  it('Ζ1 οθόνη όπως πριν: χρώμα αυτούσιο, προεπιλογή `THIN`, χωρίς παύλα, save = restore', () => {
    expect(outline()).toStrictEqual({
      fills: [], texts: [], strokes: [{ ink: SLAB_BLUE, width: RENDER_LINE_WIDTHS.THIN, dash: [] }], saves: 1, restores: 1,
    });
    expect(outline(2.5).strokes[0].width).toBe(2.5);
  });

  it.each(PLOT_STYLES)('Ζ2 🔴 δημόσια κάτοψη «%s»: μελάνι πολιτικής, πάχος ≥ δάπεδο', (style) => {
    setPrintColorPolicy(publicImage(style));
    const [stroke] = outline().strokes;
    expect(onPaper(stroke.ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
    if (style !== 'colour') expect(isGrey(stroke.ink)).toBe(true);
    expect(stroke.width).toBe(FLOOR_PX);
  });

  it('Ζ3 🔴 PDF του μηχανικού: μαύρο, το πάχος που ζητήθηκε', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    expect(outline(2.5).strokes).toStrictEqual([{ ink: '#000000', width: 2.5, dash: [] }]);
  });
});
