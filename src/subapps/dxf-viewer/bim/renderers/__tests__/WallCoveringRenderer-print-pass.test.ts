/**
 * ADR-909 Γ2.5 (Η4) — ο `WallCoveringRenderer` ρωτά την πολιτική εκτύπωσης για περίγραμμα και γραμμοσκίαση.
 *
 * Πριν: `strokeStyle = color` · `lineWidth = 1,2` για το περίγραμμα και `rgba(0, 0, 0, 0.18)` · `0,5` για τη
 * γραμμοσκίαση, ωμά.
 *
 * 🔶 Η πύλη pixels (3.101) ΔΕΝ βλέπει αυτόν τον ζωγράφο: το προφίλ της δημόσιας κάτοψης **κρύβει** την επένδυση
 * (`'wall-covering': 'hide'`). Στο χαρτί φτάνει μόνο από το PDF του μηχανικού — άρα αυτές οι άγκυρες είναι το
 * **μόνο** που τον κρίνει.
 *
 * Ε1 οθόνη όπως πριν · Ε2 με δάπεδα (η πολιτική της δημόσιας κάτοψης): κάθε γραμμή και κάθε τελεία πλήρες μελάνι
 * ≥ 3:1 στο δάπεδο πάχους, άχρωμα στις άχρωμες στάθμες, και τίποτε δεν χάθηκε · Ε3 PDF του μηχανικού: άχρωμο,
 * χωρίς δάπεδο 4 px · Ε4 `save` / `restore` ζευγαρώνουν.
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

import { WallCoveringRenderer } from '../WallCoveringRenderer';
import { MIN_ENTITY_CONTRAST } from '../../../config/contrast-adaptation';
import { clearPrintColorPolicy, setPrintColorPolicy } from '../../../config/print-color-policy';
import { RENDER_LINE_WIDTHS } from '../../../config/text-rendering-config';
import type { WallCoveringMaterialId } from '../../types/wall-covering-types';
import { getWallCoveringColor } from '../../wall-coverings/wall-covering-material-catalog';
import { ENGINEER_PDF, FLOOR_PX, PLOT_STYLES, isGrey, isOpaque, onPaper, publicImage } from './print-pass-policies';
import type { Painted } from './recording-canvas';
import { paintedBy, sampleWall, sampleWallCovering } from './structural-samples';

/** Το αχνό μελάνι και το πάχος της γραμμοσκίασης όπως ήταν γραμμένα στον ζωγράφο — η «οθόνη όπως πριν». */
const SCREEN_HATCH_INK = 'rgba(0, 0, 0, 0.18)';
const SCREEN_HATCH_WIDTH = 0.5;
const BOUNDARY = RENDER_LINE_WIDTHS.BIM_FINISH_BOUNDARY;

/** Ένα υλικό ανά δρόμο γραμμοσκίασης: πλέγμα γραμμών · τελείες · οριζόντιες γραμμές · καμία. */
const MATERIALS: ReadonlyArray<readonly [WallCoveringMaterialId, { hatchLines: boolean; dots: boolean }]> = [
  ['tile-ceramic', { hatchLines: true, dots: false }],
  ['plaster-traditional', { hatchLines: false, dots: true }],
  ['knauf-gypsum-board', { hatchLines: false, dots: false }],
  ['paint-red', { hatchLines: false, dots: false }],
];

const host = sampleWall();

function paint(materialId: WallCoveringMaterialId): Painted {
  return paintedBy((ctx) => {
    const renderer = new WallCoveringRenderer(ctx);
    renderer.setWallsById(new Map([[host.id, host]]));
    return renderer;
  }, sampleWallCovering(host, materialId));
}

/** Το περίγραμμα χαράζεται τελευταίο· ό,τι προηγείται είναι γραμμοσκίαση. Το σώμα γεμίζει πρώτο· ό,τι ακολουθεί είναι τελείες. */
const parts = (painted: Painted) => ({
  outline: painted.strokes[painted.strokes.length - 1],
  hatch: painted.strokes.slice(0, -1),
  dots: painted.fills.slice(1),
});

afterEach(clearPrintColorPolicy);

describe.each(MATERIALS)('WallCoveringRenderer — «%s» (ADR-909 Γ2.5 Η4)', (materialId, expected) => {
  it('Ε1 οθόνη όπως πριν: περίγραμμα στο χρώμα του υλικού 1,2 px, γραμμοσκίαση αχνή 0,5 px', () => {
    const { outline, hatch, dots } = parts(paint(materialId));
    expect(outline).toStrictEqual({ ink: getWallCoveringColor(materialId), width: BOUNDARY, dash: [] });
    expect(hatch.length > 0).toBe(expected.hatchLines);
    expect(dots.length > 0).toBe(expected.dots);
    for (const s of hatch) expect(s).toStrictEqual({ ink: SCREEN_HATCH_INK, width: SCREEN_HATCH_WIDTH, dash: [] });
    for (const dot of dots) expect(dot).toBe(SCREEN_HATCH_INK);
  });

  it.each(PLOT_STYLES)('Ε2 🔴 με δάπεδα «%s»: πλήρες μελάνι ≥ 3:1 στο δάπεδο πάχους — και τίποτε δεν χάθηκε', (style) => {
    const onScreen = paint(materialId);
    setPrintColorPolicy(publicImage(style));
    const printed = paint(materialId);
    expect(printed.strokes).toHaveLength(onScreen.strokes.length);
    expect(printed.fills).toHaveLength(onScreen.fills.length);
    for (const s of printed.strokes) {
      expect(s.width).toBe(FLOOR_PX);
      expect(isOpaque(s.ink)).toBe(true);
      expect(onPaper(s.ink)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
      if (style !== 'colour') expect(isGrey(s.ink)).toBe(true);
    }
    for (const dot of parts(printed).dots) {
      expect(isOpaque(dot)).toBe(true);
      expect(onPaper(dot)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
    }
  });

  it('Ε3 PDF του μηχανικού: άχρωμο, το πάχος του περιγράμματος όπως το ζήτησε', () => {
    setPrintColorPolicy(ENGINEER_PDF);
    const { outline, hatch, dots } = parts(paint(materialId));
    expect(outline).toStrictEqual({ ink: '#000000', width: BOUNDARY, dash: [] });
    for (const s of hatch) expect(s).toStrictEqual({ ink: '#000000', width: 1, dash: [] });
    for (const dot of dots) expect(dot).toBe('#000000');
  });

  it('Ε4 `save` / `restore` ζευγαρώνουν', () => {
    const { saves, restores } = paint(materialId);
    expect(saves).toBeGreaterThan(0);
    expect(restores).toBe(saves);
  });
});
