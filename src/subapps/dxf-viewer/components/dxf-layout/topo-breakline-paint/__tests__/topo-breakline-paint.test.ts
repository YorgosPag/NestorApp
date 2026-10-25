/**
 * ADR-920 Β4.8 Β1 — ο κοινός δρόμος WORLD→οθόνη των ασυνεχειών + το λεξιλόγιο στυλ τους.
 *
 * Η κρίσιμη άγκυρα είναι ο ΜΗ-ταυτοτικός projector: με τον ταυτοτικό (μη γεωαναφερμένο έργο) το
 * «ξέχασα το project» είναι αόρατο — ακριβώς έτσι έζησε το σφάλμα στον overlay των υποψηφίων.
 */
import { breaklineScreenPath } from '../topo-breakline-screen-path';
import {
  breaklineDashPattern, breaklineSvgDasharray, TOPO_BREAKLINE_STROKE_PX, TOPO_BREAKLINE_VERTEX_DOT_PX,
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
    const patterns = (['elevation', 'proximity', 'surface'] as const).map(breaklineDashPattern);
    expect(new Set(patterns.map((p) => JSON.stringify(p))).size).toBe(3);
  });

  it('elevation = συνεχής· άγνωστη (παλιά αποθηκευμένη) = συνεχής, όχι μαντεψιά', () => {
    expect(breaklineDashPattern('elevation')).toBeNull();
    expect(breaklineDashPattern(undefined)).toBeNull();
  });
});

/**
 * Το SVG με στρογγυλά άκρα ζωγραφίζει `w/2` πέρα από κάθε άκρο παύλας. Η άγκυρα μετρά ό,τι ΒΛΕΠΕΙ
 * το μάτι (dash + w φωτεινό, gap − w σκοτεινό) — όχι συμβολοσειρές, που ήταν «πράσινες» ενώ στην
 * οθόνη το `2 4` γινόταν 5/1 και το `8 4` 11/1, δηλαδή τρεις πηγές σχεδόν ίδιες.
 */
describe('breaklineSvgDasharray — ορατό μοτίβο με στρογγυλά άκρα', () => {
  const W = TOPO_BREAKLINE_STROKE_PX.stroke;
  const visible = (dasharray: string | null): { lit: number; dark: number } => {
    const [dash, gap] = dasharray!.split(' ').map(Number);
    return { lit: dash! + W, dark: gap! - W };
  };

  it('διακεκομμένη (proximity): το μάτι βλέπει ακριβώς το δηλωμένο μοτίβο', () => {
    const p = breaklineDashPattern('proximity')!;
    expect(visible(breaklineSvgDasharray(p, W))).toEqual({ lit: p.dashPx, dark: p.gapPx });
  });

  it('κουκκίδες (surface): κύκλος διαμέτρου ίσης με το πάχος, κενό όσο δηλώθηκε', () => {
    const p = breaklineDashPattern('surface')!;
    expect(breaklineSvgDasharray(p, W)).toBe(`0 ${p.gapPx + W}`);
    expect(visible(breaklineSvgDasharray(p, W))).toEqual({ lit: W, dark: p.gapPx });
  });

  it('κάθε σκοτεινό κενό είναι ΟΡΑΤΟ (≥ 3 px) — η κλάση του σφάλματος, όχι το δείγμα', () => {
    for (const source of ['proximity', 'surface'] as const) {
      expect(visible(breaklineSvgDasharray(breaklineDashPattern(source), W)).dark).toBeGreaterThanOrEqual(3);
    }
  });

  it('συνεχής ⇒ κανένα dasharray', () => {
    expect(breaklineSvgDasharray(null, W)).toBeNull();
  });
});

describe('topo-breakline-style — πάχη', () => {
  it('τα πάχη είναι ΔΑΝΕΙΚΑ από τις υποψήφιες: η «Προσθήκη» αλλάζει χρώμα, όχι μέγεθος', () => {
    expect(TOPO_BREAKLINE_STROKE_PX.stroke).toBe(AUTO_BREAKLINE_STROKE_PX.approved);
    expect(TOPO_BREAKLINE_STROKE_PX.casing).toBeGreaterThan(TOPO_BREAKLINE_STROKE_PX.stroke);
    expect(TOPO_BREAKLINE_VERTEX_DOT_PX).toBe(AUTO_BREAKLINE_CORNER_DOT_PX);
  });
});
