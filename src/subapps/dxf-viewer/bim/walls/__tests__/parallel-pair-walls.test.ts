/**
 * ADR-911 Δ5 · ADR-929 Δ7 — τοίχοι από παράλληλα ζεύγη παρειών, σε διανυσματικές γραμμές (mm).
 *
 *   Π-1  περιγραμμένο σπίτι (όριο της ένωσης, χωρίς κλειστά ορθογώνια) ⇒ 5 τοίχοι, σωστά πάχη· γωνία L στον άξονα.
 *   Π-2  κόμβος Τ (κενό στη μία παρειά) γεφυρώνεται · άνοιγμα (κενό και στις δύο) κόβει.
 *   Π-3  γραμμή διάστασης έξω από τον τοίχο δεν γίνεται τοίχος (η παρειά χρησιμοποιείται μία φορά).
 *   Π-4  κλειστό ορθογώνιο 4 γραμμών ⇒ ένας τοίχος, όχι δεύτερος από τα καπάκια.
 *   Π-5  λοξός τοίχος κρατά τη γωνία του.
 *   Π-6  μέσα από το αμετάβλητο `computeWallProposal`: οι τοίχοι ενώνονται στους άξονες (auto-join).
 *   Π-7  το πραγματικό σχέδιο δοκιμής του ADR-911: 40/40 σώματα σε ακριβώς έναν τοίχο, 0 ψευδείς, 34 τοίχοι.
 */

import { describe, expect, it } from '@jest/globals';
import type { Entity } from '../../../types/entities';
import { MODEL_FROM_DRAWING_LIMITS } from '../../../config/tolerance-config';
import { closedRectangleStrategy, createParallelPairStrategy } from '../../model-from-drawing/wall-detection-strategy';
import { proposeConfirmed } from '../../model-from-drawing/__tests__/confirmed-proposal';
import { pointInPolygon } from '@/lib/geometry/planar-polygon';
import { detectedRectAxis, extractLineSegments, type DetectedRectangle, type RegionLineSeg } from '../wall-in-region';
import fixture from '../../model-from-drawing/__tests__/fixtures/floor-plan-lines.json';

const TOL = MODEL_FROM_DRAWING_LIMITS.NODE_MERGE_TOLERANCE_MM;
const strategy = createParallelPairStrategy({ sceneUnits: 'mm' });

const seg = (id: string, ax: number, ay: number, bx: number, by: number): RegionLineSeg =>
  ({ id, start: { x: ax, y: ay }, end: { x: bx, y: by } });

/**
 * Το σπίτι 6 × 4 m των συνθετικών δειγμάτων (τοίχοι 250 έξω, 100 μέσα στο x = 3500), σχεδιασμένο όπως σε κάτοψη:
 * το όριο της ένωσης. Η εσωτερική παρειά του νότιου/βόρειου τοίχου διακόπτεται εκεί που ενώνεται ο εσωτερικός.
 */
const HOUSE: readonly RegionLineSeg[] = [
  seg('S-out', -125, -125, 6125, -125), seg('N-out', -125, 4125, 6125, 4125),
  seg('W-out', -125, -125, -125, 4125), seg('E-out', 6125, -125, 6125, 4125),
  seg('S-in-a', 125, 125, 3450, 125), seg('S-in-b', 3550, 125, 5875, 125),
  seg('N-in-a', 125, 3875, 3450, 3875), seg('N-in-b', 3550, 3875, 5875, 3875),
  seg('W-in', 125, 125, 125, 3875), seg('E-in', 5875, 125, 5875, 3875),
  seg('I-w', 3450, 125, 3450, 3875), seg('I-e', 3550, 125, 3550, 3875),
];

/** Άξονας με σταθερή φορά και στρογγύλεμα στο 1e-6 mm (ο θόρυβος float της τριγωνομετρίας δεν είναι εύρημα). */
function axisOf(r: DetectedRectangle): { a: { x: number; y: number }; b: { x: number; y: number }; t: number } {
  const ax = detectedRectAxis(r);
  const round = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  const pt = (p: { x: number; y: number }) => ({ x: round(p.x), y: round(p.y) });
  const [a, b] = ax.start.x + ax.start.y <= ax.end.x + ax.end.y ? [ax.start, ax.end] : [ax.end, ax.start];
  return { a: pt(a), b: pt(b), t: round(ax.thickness) };
}

const near = (v: number, want: number) => Math.abs(v - want) < 1e-6;

describe('findWallsFromParallelPairs (μέσω createParallelPairStrategy)', () => {
  it('Π-1 περιγραμμένο σπίτι ⇒ 5 τοίχοι· γωνίες L στους άξονες, Τ στην παρειά (το κλείνει το auto-join)', () => {
    const rects = strategy(HOUSE, TOL).map(axisOf);
    expect(rects).toHaveLength(5);
    const south = rects.find((r) => near(r.a.y, 0) && near(r.b.y, 0));
    expect(south).toMatchObject({ a: { x: 0, y: 0 }, b: { x: 6000, y: 0 }, t: 250 }); // Π-2: Τ γεφυρωμένο
    const inner = rects.find((r) => near(r.a.x, 3500));
    expect(inner).toMatchObject({ a: { x: 3500, y: 125 }, b: { x: 3500, y: 3875 }, t: 100 });
    expect(rects.filter((r) => near(r.t, 250))).toHaveLength(4);
  });

  it('Π-2 άνοιγμα 900 mm στον νότιο τοίχο: κενό και στις δύο παρειές ⇒ δύο τοίχοι', () => {
    const withOpening = HOUSE.filter((s) => s.id !== 'S-out' && s.id !== 'S-in-a').concat([
      seg('S-out-a', -125, -125, 1500, -125), seg('S-out-b', 2400, -125, 6125, -125),
      seg('S-in-a1', 125, 125, 1500, 125), seg('S-in-a2', 2400, 125, 3450, 125),
    ]);
    const south = strategy(withOpening, TOL).map(axisOf).filter((r) => near(r.a.y, 0) && near(r.b.y, 0));
    expect(south.map((r) => [r.a.x, r.b.x]).sort((p, q) => p[0] - q[0])).toEqual([[0, 1500], [2400, 6000]]);
  });

  it('Π-3 γραμμή διάστασης 400 mm έξω από την εξωτερική παρειά: όχι τοίχος', () => {
    const rects = strategy([...HOUSE, seg('dim', -125, -525, 6125, -525)], TOL);
    expect(rects).toHaveLength(5);
  });

  it('Π-4 κλειστό ορθογώνιο 250 × 800 ⇒ ένας τοίχος με κατακόρυφο άξονα', () => {
    const closed = [seg('a', 0, 0, 250, 0), seg('b', 250, 0, 250, 800), seg('c', 250, 800, 0, 800), seg('d', 0, 800, 0, 0)];
    const rects = strategy(closed, TOL).map(axisOf);
    expect(rects).toEqual([{ a: { x: 125, y: 0 }, b: { x: 125, y: 800 }, t: 250 }]);
  });

  it('Π-5 λοξός τοίχος 45° πάχους 100: κρατά τη γωνία του', () => {
    const h = 50 * Math.SQRT1_2;
    const rects = strategy([seg('p', -h, h, 2000 - h, 2000 + h), seg('q', h, -h, 2000 + h, 2000 - h)], TOL).map(axisOf);
    expect(rects).toHaveLength(1);
    expect(rects[0].t).toBeCloseTo(100, 6);
    expect(Math.atan2(rects[0].b.y - rects[0].a.y, rects[0].b.x - rects[0].a.x) * 180 / Math.PI).toBeCloseTo(45, 6);
  });
});

/** Κλειστό ορθογώνιο 4 γραμμών w × h με κάτω αριστερή γωνία στο (x0, y0). */
const closedBox = (x0: number, y0: number, w: number, h: number): RegionLineSeg[] => [
  seg('s', x0, y0, x0 + w, y0), seg('e', x0 + w, y0, x0 + w, y0 + h),
  seg('n', x0 + w, y0 + h, x0, y0 + h), seg('w', x0, y0 + h, x0, y0),
];

describe('ADR-929 §6.14 — βήμα 9: κανένας άξονας που δεν τον ξέρουμε (κανόνας Α: μόνο ο λόγος, όπως το σχέδιο)', () => {
  it('Π-8 κλειστό 300 × 250 (σχεδόν τετράγωνο) ⇒ ένα ορθογώνιο ΧΩΡΙΣ άξονα, ίδιο σώμα', () => {
    const rects = strategy(closedBox(0, 0, 300, 250), TOL);
    expect(rects).toHaveLength(1);
    expect(rects[0].axis).toBeUndefined();
    expect(rects[0].area).toBeCloseTo(300 * 250, 6);
    expect(rects[0].longSide).toBeCloseTo(300, 6);
    expect(rects[0].shortSide).toBeCloseTo(250, 6);
  });

  it('Π-8β παραστάδα 200 × 250 (το ζεύγος των παραστάδων είναι το λεπτότερο) ⇒ επίσης χωρίς άξονα', () => {
    const rects = strategy(closedBox(0, 0, 200, 250), TOL);
    expect(rects).toHaveLength(1);
    expect(rects[0].axis).toBeUndefined();
  });

  it('Π-9 δύο παρειές 300 μήκος σε απόσταση 250, ΧΩΡΙΣ καπάκια ⇒ ΧΩΡΙΣ άξονα: το σχήμα δεν λέει αν το πάχος είναι 250 ή 300', () => {
    // Κανόνας Α (ADR-929 §6.14): η απόσταση του ζεύγους δεν είναι γνώση προσανατολισμού σε σχεδόν τετράγωνο κομμάτι.
    // Το σχέδιο εδώ δεν βγάζει ορθογώνιο (δεν κλείνει)· η εικόνα βγάζει ερώτηση, ποτέ σιωπηλό τοίχο με μαντεμένο άξονα.
    const rects = strategy([seg('p', 0, 0, 300, 0), seg('q', 0, 250, 300, 250)], TOL);
    expect(rects).toHaveLength(1);
    expect(rects[0].axis).toBeUndefined();
    expect(rects[0].area).toBeCloseTo(300 * 250, 6);
  });

  it('Π-10 κοντός τοίχος σύνδεσης 300 × 250 ανάμεσα σε δύο κάθετους ⇒ ΧΩΡΙΣ άξονα, ΙΔΙΑ ερώτηση με το σχέδιο', () => {
    const walls = [
      seg('W-a', -250, -1000, -250, 1250), seg('W-b', 0, -1000, 0, 1250),
      seg('E-a', 300, -1000, 300, 1250), seg('E-b', 550, -1000, 550, 1250),
      seg('C-a', 0, 0, 300, 0), seg('C-b', 0, 250, 300, 250),
    ];
    const at = (rs: readonly DetectedRectangle[]) => rs.find((r) => pointInPolygon({ x: 150, y: 125 }, r.polygon));
    const rects = strategy(walls, TOL);
    const connector = at(rects);
    expect(connector).toBeDefined();
    expect(connector?.axis).toBeUndefined();
    // Οι μακριοί κάθετοι κρατούν τον άξονά τους.
    expect(rects.filter((r) => r !== connector).every((r) => r.axis !== undefined)).toBe(true);
    // Το σχέδιο, με τις ίδιες γραμμές, ΔΕΝ βγάζει εδώ ορθογώνιο (μετρημένο 2026-11-10), όπως στο Π-9.
    expect(at(closedRectangleStrategy(walls, TOL))).toBeUndefined();
  });

  // Π-12 (ADR-929 §6.15): μετρημένο στην εικόνα του σχεδίου δοκιμής, άνοιγμα 250 σε τοίχο 250 έβγαινε «τοίχος»
  // 250 × 250 πάνω στο άνοιγμα (τα καπάκια ζευγάρωσαν πριν από τις παρειές). Η περίπτωση 200 < 250 δείχνει ότι
  // το πρόβλημα είναι η κλάση «άνοιγμα ≤ πάχος», όχι η ισοπαλία.
  it.each([250, 200])('Π-12 άνοιγμα %i mm σε τοίχο 250 ⇒ δύο τοίχοι, κανένας πάνω στο άνοιγμα', (opening) => {
    const e = 1000 + opening;
    const lines = [
      seg('s-w', 0, 0, 1000, 0), seg('n-w', 0, 250, 1000, 250),
      seg('s-e', e, 0, 3000, 0), seg('n-e', e, 250, 3000, 250),
      seg('cap-0', 0, 0, 0, 250), seg('cap-w', 1000, 0, 1000, 250),
      seg('cap-e', e, 0, e, 250), seg('cap-3', 3000, 0, 3000, 250),
    ];
    const rects = strategy(lines, TOL);
    expect(rects).toHaveLength(2);
    expect(rects.some((r) => pointInPolygon({ x: 1000 + opening / 2, y: 125 }, r.polygon))).toBe(false);
    expect(rects.every((r) => r.axis !== undefined)).toBe(true);
  });

  it('Π-11 όριο του κατωφλίου: λόγος ΑΚΡΙΒΩΣ 1,75 δεν είναι «σχεδόν τετράγωνο»· 0,001 mm κάτω είναι', () => {
    const ratio = MODEL_FROM_DRAWING_LIMITS.AMBIGUOUS_ASPECT_RATIO;
    const at = strategy(closedBox(0, 0, 250 * ratio, 250), TOL);
    const below = strategy(closedBox(0, 0, 250 * ratio - 0.001, 250), TOL);
    expect(at).toHaveLength(1);
    expect(at[0].axis).toBeDefined();
    expect(below).toHaveLength(1);
    expect(below[0].axis).toBeUndefined();
  });

  it('Π-4 (ξανά): το μακρόστενο κλειστό ορθογώνιο κρατά τον άξονά του', () => {
    expect(strategy(closedBox(0, 0, 250, 800), TOL)[0].axis).toBeDefined();
  });
});

describe('Π-6 μέσα από το αμετάβλητο computeWallProposal', () => {
  const entities = HOUSE.map((s) => ({ id: s.id, type: 'line', color: '#000000', start: s.start, end: s.end }) as unknown as Entity);

  it('5 τοίχοι έτοιμοι, άξονας από κόμβο σε κόμβο, όλες οι γραμμές εξηγημένες', () => {
    const p = proposeConfirmed({
      entities, wallColorHex: '#000000', colorOf: () => '#000000', sceneUnits: 'mm', levelId: 'lvl', strategy,
    });
    expect(p.items.map((i) => i.status)).toEqual(['ready', 'ready', 'ready', 'ready', 'ready']);
    // Κάθε άξονας από κόμβο σε κόμβο: γωνίες L (μέσος των παρειών) και Τ (auto-join) ακριβώς στους άξονες.
    const key = (w: (typeof p.walls)[number]) => {
      const pts = [w.params.start, w.params.end].map((q) => [Math.round(q.x), Math.round(q.y)]).sort((m, n) => m[0] - n[0] || m[1] - n[1]);
      return `${pts[0].join(',')}→${pts[1].join(',')} t${Math.round(w.params.thickness)}`;
    };
    expect(p.walls.map(key).sort()).toEqual([
      '0,0→0,4000 t250', '0,0→6000,0 t250', '0,4000→6000,4000 t250', '3500,0→3500,4000 t100', '6000,0→6000,4000 t250',
    ]);
    expect(p.coverage.unexplainedIds).toEqual([]);
  });
});

describe('Π-7 πραγματικό σχέδιο δοκιμής (ADR-911, «Ισόγειο 1.dxf»)', () => {
  const entities = (fixture.entities as unknown as readonly Entity[])
    .filter((e) => ((e as { color?: string }).color ?? '').toLowerCase() === '#003fff');
  const segments = extractLineSegments(entities);
  const closed = closedRectangleStrategy(segments, TOL);
  const pairs = strategy(segments, TOL);
  const centre = (r: DetectedRectangle) => ({
    x: (r.polygon[0].x + r.polygon[2].x) / 2, y: (r.polygon[0].y + r.polygon[2].y) / 2,
  });
  const hostsOf = (r: DetectedRectangle) => pairs.filter((p) => pointInPolygon(centre(r), p.polygon));

  it('κάθε σώμα του corner-graph φιλοξενείται από ΑΚΡΙΒΩΣ έναν τοίχο-ζεύγος ίδιου πάχους', () => {
    expect(closed).toHaveLength(40);
    for (const r of closed) {
      const hosts = hostsOf(r);
      expect(hosts).toHaveLength(1);
      expect(detectedRectAxis(hosts[0]).thickness).toBeCloseTo(detectedRectAxis(r).thickness, 3);
    }
  });

  it('κανένας τοίχος-ζεύγος χωρίς σώμα (ακρίβεια) · 40 ⇒ 34: 6 συγχωνεύσεις συγγραμμικών ίδιου πάχους', () => {
    const empty = pairs.filter((p) => !closed.some((r) => pointInPolygon(centre(r), p.polygon)));
    expect(empty).toEqual([]);
    // Μετρημένο 2026-11-04: εφαπτόμενα συγγραμμικά ορθογώνια ίδιου πάχους (ένας τοίχος σχεδιασμένος σε κομμάτια,
    // ή συνεχής τοίχος μέσα από κόμβο Τ/Χ) διαβάζονται ως ΕΝΑΣ τοίχος, όπως στο ArchiCAD/Revit.
    expect(pairs).toHaveLength(34);
  });
});
