/**
 * ADR-909 Γ2.5 (Η4) · Γ2.6α — οι **εφεδρείες χρώματος** του ανοίγματος, του ανοίγματος πλάκας και της δοκού
 * ρωτούν την πολιτική εκτύπωσης.
 *
 * 🔶 Σήμερα ο δρόμος αυτός είναι **απρόσιτος σε print pass**: το `resolveSubcategoryStyle` περνά κάθε χρώμα από το
 * `applyPlotColor`, που δεν γυρίζει ποτέ `null` — άρα η εφεδρεία δεν φτάνει στο χαρτί. Γι' αυτό ο επιλυτής εδώ
 * είναι **πλαστός** και γυρίζει «κανένα χρώμα»: η άγκυρα κρίνει τι θα τύπωνε ο ζωγράφος **αν** ο επιλυτής πάψει
 * κάποτε να αποφασίζει μόνος του (ζώνη και τιράντες — χωρίς αυτήν, μετάλλαξη της εφεδρείας δεν τη σκοτώνει κανείς).
 *
 * Ζ1 οθόνη όπως πριν: το χρώμα του είδους αυτούσιο · Ζ2 χαρτί ⇒ πλήρες μελάνι ≥ 3:1, άχρωμο στις άχρωμες στάθμες.
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

jest.mock('../../../config/bim-line-weight-resolver', () => ({
  ...jest.requireActual('../../../config/bim-line-weight-resolver'),
  resolveSubcategoryStyle: () => ({ lineWidthPx: 4, linePattern: 'solid', color: null }),
}));

import { BeamRenderer } from '../BeamRenderer';
import { buildBeamEntity, buildDefaultBeamParams } from '../../../hooks/drawing/beam-completion';
import { LAYER_ID, built } from '../../../print/public-floorplan/pixel-gate/pixel-gate-sample-kit';
import { OpeningRenderer } from '../OpeningRenderer';
import { SlabOpeningRenderer } from '../SlabOpeningRenderer';
import { MIN_ENTITY_CONTRAST } from '../../../config/contrast-adaptation';
import { clearPrintColorPolicy, setPrintColorPolicy } from '../../../config/print-color-policy';
import { OPENING_KIND_STROKE } from '../opening-kind-style';
import { ENGINEER_PDF, PLOT_STYLES, isGrey, isOpaque, onPaper, publicImage } from './print-pass-policies';
import type { Painted } from './recording-canvas';
import { paintedBy, sampleOpening, sampleSlabOpening, sampleWall } from './structural-samples';

const wall = sampleWall();
/** Το χρώμα του είδους όπως είναι γραμμένο στον ζωγράφο (`KIND_STROKE.shaft`) — η «οθόνη όπως πριν». */
const SHAFT_STROKE = '#1f3a5f';

/** `KIND_STROKE.straight` της δοκού (Γ2.6α) — περίγραμμα **και** άξονας κληρονομούν την ίδια εφεδρεία. */
const BEAM_STRAIGHT_STROKE = '#b07d1f';
const sampleBeam = () => built('beam', buildBeamEntity(buildDefaultBeamParams({ x: 0, y: 0 }, { x: 3000, y: 0 }), LAYER_ID));

const SAMPLES: ReadonlyArray<readonly [string, string, () => Painted]> = [
  ['beam', BEAM_STRAIGHT_STROKE, () => paintedBy((ctx) => new BeamRenderer(ctx), sampleBeam())],
  ['slab-opening', SHAFT_STROKE, () => paintedBy((ctx) => new SlabOpeningRenderer(ctx), sampleSlabOpening())],
  ['opening', OPENING_KIND_STROKE.door, () => paintedBy((ctx) => new OpeningRenderer(ctx), sampleOpening(wall))],
];

afterEach(clearPrintColorPolicy);

describe.each(SAMPLES)('εφεδρεία χρώματος «%s» (ADR-909 Γ2.5 Η4)', (_name, kindStroke, paint) => {
  it('Ζ1 οθόνη όπως πριν: το χρώμα του είδους αυτούσιο', () => {
    const { strokes } = paint();
    expect(strokes.length).toBeGreaterThan(0);
    for (const s of strokes) expect(s.ink).toBe(kindStroke);
  });

  it.each(PLOT_STYLES)('Ζ2 🔴 με δάπεδα «%s»: πλήρες μελάνι ≥ 3:1, άχρωμο στις άχρωμες στάθμες', (style) => {
    setPrintColorPolicy(publicImage(style));
    const { strokes } = paint();
    expect(strokes.length).toBeGreaterThan(0);
    for (const s of strokes) {
      expect(isOpaque(s.ink)).toBe(true);
      expect(onPaper(s.ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
      if (style !== 'colour') expect(isGrey(s.ink)).toBe(true);
    }
  });

  it('Ζ2 PDF του μηχανικού: άχρωμο', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    for (const s of paint().strokes) expect(s.ink).toBe('#000000');
  });
});
