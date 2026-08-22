jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-771 Φ.3 — **η άγκυρα του ζωγράφου**: το casing ζωγραφίζεται *πραγματικά*, και **μόνο**
 * όπου η υπόσχεση αθετείται.
 *
 * ## Γιατί υπάρχει
 * Το μάθημα της Φ.1 αυτούσιο: όταν άλλαξε η γωνία των σημαδιών, **και τα 170** υπάρχοντα tests
 * του φακέλου έμειναν πράσινα — καμία άγκυρα δεν κλείδωνε **πού** ζωγραφίζεται. Εδώ
 * επαληθεύτηκε ξανά: μετά την προσθήκη του casing, τα 67 υπάρχοντα tests πέρασαν **αμετάβλητα**.
 * Άρα η αλλαγή ήταν ορατή μόνο στην οθόνη, σε **κανένα** test.
 *
 * Καταγράφει την **ακολουθία** των περασμάτων (κάθε `stroke()` με την ισχύουσα κατάσταση, με
 * σωστή σημασιολογία `save`/`restore`) και απαιτεί ζεύγη casing→μελάνι με **μετρήσιμη** σχέση:
 * αντίθετο άκρο, ακριβώς +{@link CONTRAST_CASING_EXTRA_WIDTH_PX} πάχος, casing **πρώτο**.
 */

import { WallRenderer } from '../WallRenderer';
import { CONTRAST_CASING_EXTRA_WIDTH_PX } from '../bim-contrast-casing';
import type { WallEntity } from '../../types/wall-types';
import type { EntityModel } from '../../../rendering/types/Types';
import { maxContrastInk, _clearAdaptiveColorCache } from '../../../config/adaptive-entity-color';
import { resolveDxfCanvasBackgroundHex } from '../../../config/color-config';

jest.mock('../../../state/drawing-scale-store', () => ({
  useDrawingScaleStore: { getState: jest.fn() },
}));
import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
const mockGetState = useDrawingScaleStore.getState as jest.Mock;

/** Επιφάνεια όπου το `WALL_LINE_CONTRAST = 9.0` είναι ΑΝΕΦΙΚΤΟ (μέγιστο 7,46:1). */
const SHORTFALL_SURFACE = '#555555';
/** Επιφάνεια όπου είναι εφικτό (14,82:1) — η προεπιλογή `nestorApp1`. */
const SUFFICIENT_SURFACE = '#1d283a';

// ── Καμβάς-καταγραφέας: κατάσταση με ΣΤΟΙΒΑ, χρονογραμμή περασμάτων ──────────────────────

interface PaintPass { readonly strokeStyle: string; readonly lineWidth: number; readonly dash: string }

function createRecordingCtx(): { ctx: CanvasRenderingContext2D; paints: PaintPass[] } {
  const paints: PaintPass[] = [];
  let state = { strokeStyle: '', lineWidth: 0, dash: '[]' };
  const stack: (typeof state)[] = [];
  const noop = (): void => {};
  const canvas = {
    width: 800, height: 600,
    getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600, x: 0, y: 0 }),
  };
  const ctx = {
    canvas,
    save: (): void => { stack.push({ ...state }); },
    restore: (): void => { state = stack.pop() ?? state; },
    beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop,
    fill: noop, clip: noop, arc: noop,
    stroke: (): void => { paints.push({ ...state }); },
    setLineDash: (d: readonly number[]): void => { state = { ...state, dash: JSON.stringify(d) }; },
    set globalCompositeOperation(_v: string) {},
    set globalAlpha(_v: number) {},
    set fillStyle(_v: string) {},
    set strokeStyle(v: string) { state = { ...state, strokeStyle: v }; },
    set lineWidth(v: number) { state = { ...state, lineWidth: v }; },
    set lineCap(_v: string) {},
    set lineJoin(_v: string) {},
    set shadowBlur(_v: number) {},
    set shadowColor(_v: string) {},
  };
  return { paints, ctx: ctx as unknown as CanvasRenderingContext2D };
}

/** Διαδοχικά ζεύγη περασμάτων που έχουν τη ΓΕΩΜΕΤΡΙΑ ενός casing: πλατύτερο, αντίθετο άκρο. */
function casingPairs(paints: readonly PaintPass[]): readonly [PaintPass, PaintPass][] {
  const out: [PaintPass, PaintPass][] = [];
  for (let i = 0; i + 1 < paints.length; i += 1) {
    const [under, over] = [paints[i], paints[i + 1]];
    if (under.lineWidth !== over.lineWidth + CONTRAST_CASING_EXTRA_WIDTH_PX) continue;
    if (under.strokeStyle !== maxContrastInk(over.strokeStyle)) continue;
    out.push([under, over]);
  }
  return out;
}

function makeWall(): WallEntity {
  return {
    id: 'wall_casing', type: 'wall', kind: 'exterior', layerId: '0',
    params: { category: 'exterior', height: 3000, baseOffset: 0, thickness: 200 },
    geometry: {
      outerEdge: { points: [{ x: 0, y: -100, z: 0 }, { x: 5000, y: -100, z: 0 }] },
      innerEdge: { points: [{ x: 0, y: 100, z: 0 }, { x: 5000, y: 100, z: 0 }] },
      axisPolyline: { points: [{ x: 0, y: 0, z: 0 }, { x: 5000, y: 0, z: 0 }] },
      bbox: { min: { x: 0, y: -100 }, max: { x: 5000, y: 100 }, minZm: 0, maxZm: 3000 },
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as WallEntity;
}

function renderOn(surfaceHex: string): readonly PaintPass[] {
  document.documentElement.style.setProperty('--canvas-background-dxf', surfaceHex);
  _clearAdaptiveColorCache();
  // ΒΑΘΜΟΝΟΜΗΣΗ: χωρίς αυτό, ένα jsdom που δεν επιστρέφει την τιμή θα έκανε ΚΑΘΕ έλεγχο
  // παρακάτω να μετρά το προεπιλεγμένο σκούρο — δηλαδή «πράσινο επειδή δεν κοίταξα».
  expect(resolveDxfCanvasBackgroundHex()).toBe(surfaceHex);
  const { ctx, paints } = createRecordingCtx();
  const renderer = new WallRenderer(ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  renderer.render(makeWall() as unknown as EntityModel, {});
  return paints;
}

beforeEach(() => {
  mockGetState.mockReturnValue({
    drawingScale: 100,
    viewRange: { topMm: 2300, cutPlaneMm: 1200, bottomMm: 0, viewDepthMm: -300, floorAdjustedRangeMm: 1220 },
    objectStyles: {},
  });
});

afterAll(() => document.documentElement.style.removeProperty('--canvas-background-dxf'));

describe('ADR-771 Φ.3 — casing μόνο όπου η υπόσχεση αθετείται', () => {
  it('ΕΦΙΚΤΟ κατώφλι (#1d283a) ⇒ ΚΑΝΕΝΑ casing — μηδέν κόστος, ίδια εικόνα με πριν', () => {
    expect(casingPairs(renderOn(SUFFICIENT_SURFACE))).toHaveLength(0);
  });

  it('ΑΝΕΦΙΚΤΟ κατώφλι (#555555) ⇒ κάθε προσαρμοστικό πέρασμα αποκτά casing', () => {
    const pairs = casingPairs(renderOn(SHORTFALL_SURFACE));
    expect(pairs.length).toBeGreaterThan(0);
    for (const [under, over] of pairs) {
      expect(under.strokeStyle).not.toBe(over.strokeStyle);
      expect(under.lineWidth).toBeGreaterThan(over.lineWidth);
    }
  });

  it('το casing είναι ΑΚΡΙΒΩΣ το πλήθος των επιπλέον περασμάτων — τίποτα δεν ζωγραφίζεται δύο φορές χωρίς λόγο', () => {
    const sufficient = renderOn(SUFFICIENT_SURFACE);
    const shortfall = renderOn(SHORTFALL_SURFACE);
    expect(shortfall.length).toBe(sufficient.length + casingPairs(shortfall).length);
  });

  it('το casing μπαίνει ΑΠΟ ΚΑΤΩ — πρώτα το πλατύ, μετά το μελάνι (αλλιώς σβήνει τη γραμμή)', () => {
    const paints = renderOn(SHORTFALL_SURFACE);
    for (const [under, over] of casingPairs(paints)) {
      expect(paints.indexOf(under)).toBeLessThan(paints.indexOf(over));
    }
  });

  it('το ΔΙΑΣΤΙΚΤΟ μοτίβο επιβιώνει στο casing — ίδιο dash στα δύο περάσματα', () => {
    for (const [under, over] of casingPairs(renderOn(SHORTFALL_SURFACE))) {
      expect(under.dash).toBe(over.dash);
    }
  });

  it('ο άξονας (διάστικτος) παίρνει ΚΙ ΑΥΤΟΣ casing — όχι μόνο το συμπαγές περίγραμμα', () => {
    const dashed = casingPairs(renderOn(SHORTFALL_SURFACE)).filter(([u]) => u.dash !== '[]');
    expect(dashed.length).toBeGreaterThan(0);
  });
});
