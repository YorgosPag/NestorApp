/**
 * ADR-920 Β4.8 Β1 — ο κοινός δρόμος WORLD→οθόνη των ασυνεχειών + το λεξιλόγιο στυλ τους.
 *
 * Η κρίσιμη άγκυρα είναι ο ΜΗ-ταυτοτικός projector: με τον ταυτοτικό (μη γεωαναφερμένο έργο) το
 * «ξέχασα το project» είναι αόρατο — ακριβώς έτσι έζησε το σφάλμα στον overlay των υποψηφίων.
 */
import { breaklineScreenPath } from '../topo-breakline-screen-path';
import {
  breaklineDash, TOPO_BREAKLINE_STROKE_PX, TOPO_BREAKLINE_VERTEX_DOT_PX,
} from '../../../../systems/topography/topo-breakline-style';
import {
  AUTO_BREAKLINE_CORNER_DOT_PX, AUTO_BREAKLINE_STROKE_PX,
} from '../../../../systems/topography/auto-breaklines/auto-breakline-review-style';
import { CoordinateTransforms } from '../../../../rendering/core/CoordinateTransforms';
import type { WorldToDisplayProjector } from '../../../../systems/geo-referencing/geo-transform';
import type { Point2D, ViewTransform, Viewport } from '../../../../rendering/types/Types';

const TRANSFORM: ViewTransform = { scale: 0.5, offsetX: 10, offsetY: 20 };
const VIEWPORT: Viewport = { width: 800, height: 600 };

/** ΕΓΣΑ → τοπικά: αφαιρεί ένα μεγάλο offset, όπως ένας πραγματικός rigid μετασχηματισμός. */
const SHIFT: WorldToDisplayProjector = {
  isIdentity: false,
  project: (x, y) => ({ x: x - 400_000, y: y - 4_000_000 }),
  unproject: (x, y) => ({ x: x + 400_000, y: y + 4_000_000 }),
};

const toScreen = (p: Point2D): Point2D => CoordinateTransforms.worldToScreen(p, TRANSFORM, VIEWPORT);

describe('breaklineScreenPath — ο ένας δρόμος WORLD → DISPLAY → οθόνη', () => {
  const WORLD: Point2D[] = [{ x: 400_100, y: 4_000_200 }, { x: 400_300, y: 4_000_200 }];

  it('περνά από τον projector ΠΡΙΝ το transform (γεωαναφερμένο έργο)', () => {
    const { vertices } = breaklineScreenPath(WORLD, false, SHIFT, TRANSFORM, VIEWPORT);
    expect(vertices).toEqual([toScreen({ x: 100, y: 200 }), toScreen({ x: 300, y: 200 })]);
  });

  it('χωρίς γεωαναφορά (projector null) οι κορυφές μένουν ως έχουν', () => {
    const { vertices } = breaklineScreenPath(WORLD, false, null, TRANSFORM, VIEWPORT);
    expect(vertices).toEqual(WORLD.map(toScreen));
  });

  it('το path ακολουθεί τις κορυφές οθόνης· κλειστή ⇒ Z', () => {
    const open = breaklineScreenPath(WORLD, false, SHIFT, TRANSFORM, VIEWPORT);
    const closed = breaklineScreenPath(WORLD, true, SHIFT, TRANSFORM, VIEWPORT);
    const [a, b] = open.vertices;
    expect(open.d).toBe(`M${a!.x.toFixed(1)},${a!.y.toFixed(1)} L${b!.x.toFixed(1)},${b!.y.toFixed(1)}`);
    expect(closed.d).toBe(`${open.d} Z`);
  });
});

describe('topo-breakline-style — το μοτίβο λέει από πού ήρθε το z', () => {
  it('κάθε πηγή έχει ΔΙΚΟ της μοτίβο (ποτέ μόνο χρώμα — WCAG 1.4.1)', () => {
    const dashes = (['elevation', 'proximity', 'surface'] as const).map(breaklineDash);
    expect(new Set(dashes).size).toBe(3);
  });

  it('elevation = συνεχής· άγνωστη (παλιά αποθηκευμένη) = συνεχής, όχι μαντεψιά', () => {
    expect(breaklineDash('elevation')).toBeNull();
    expect(breaklineDash(undefined)).toBeNull();
  });

  it('τα πάχη είναι ΔΑΝΕΙΚΑ από τις υποψήφιες: η «Προσθήκη» αλλάζει χρώμα, όχι μέγεθος', () => {
    expect(TOPO_BREAKLINE_STROKE_PX.stroke).toBe(AUTO_BREAKLINE_STROKE_PX.approved);
    expect(TOPO_BREAKLINE_STROKE_PX.casing).toBeGreaterThan(TOPO_BREAKLINE_STROKE_PX.stroke);
    expect(TOPO_BREAKLINE_VERTEX_DOT_PX).toBe(AUTO_BREAKLINE_CORNER_DOT_PX);
  });
});
