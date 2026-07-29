/**
 * ADR-635 Φ C.23 — **1 σπασμένη οντότητα → 2.903 σπασμένες** (μετρημένο, `47_ergasia.dxf`).
 *
 * Ο μηχανισμός, βήμα-βήμα:
 *   1. `Math.min(x, NaN) === NaN` ⇒ μία οντότητα με μη-πεπερασμένο κουτί έκανε NaN **ολόκληρο**
 *      το bbox της σκηνής·
 *   2. το `normalizeEntitiesToOrigin` μετέφραζε **κάθε** οντότητα κατά `-NaN` ⇒ όλες NaN·
 *   3. το `validateScene` απέρριπτε τη σκηνή ⇒ **μηδέν** εισαγωγή, και ο ένας ένοχος
 *      πνιγμένος μέσα σε 2.903 θύματα.
 *
 * Δύο ανεξάρτητα φρένα κλειδώνονται εδώ: το κουτί που δεν μετριέται **δεν συνεισφέρει**, και
 * η μετατόπιση **δεν γίνεται ΠΟΤΕ** με μη-πεπερασμένο offset.
 */
import { normalizeEntitiesToOrigin } from '../bounds-entity';

type LooseEntity = Record<string, unknown>;

const line = (x1: number, y1: number, x2: number, y2: number): LooseEntity => ({
  id: `line_${x1}_${y1}`,
  type: 'line',
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixtures are deliberately malformed
const normalize = (entities: LooseEntity[]) => normalizeEntitiesToOrigin(entities as any);

describe('normalizeEntitiesToOrigin — μία σπασμένη οντότητα δεν μολύνει τις υπόλοιπες', () => {
  it('οντότητα με NaN αγνοείται στα bounds· οι υγιείς μετακινούνται κανονικά', () => {
    const healthy = line(100, 200, 300, 400);
    const broken: LooseEntity = { id: 'point_0', type: 'point', position: { x: NaN, y: 5 } };

    const { bounds, sourceOrigin } = normalize([broken, healthy]);

    expect([bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y].every(Number.isFinite)).toBe(true);
    expect(bounds.min).toEqual({ x: 0, y: 0 });
    expect(bounds.max).toEqual({ x: 200, y: 200 });
    expect(sourceOrigin).toEqual({ x: 100, y: 200 });
    // Η υγιής μετακινήθηκε στο (0,0)-based πλαίσιο — δηλαδή η εισαγωγή ΔΕΝ χάθηκε.
    expect(healthy.start).toEqual({ x: 0, y: 0 });
    expect(healthy.end).toEqual({ x: 200, y: 200 });
  });

  it('±Infinity αντιμετωπίζεται ακριβώς όπως το NaN (το Infinity−Infinity ξαναγεννά NaN)', () => {
    const healthy = line(10, 10, 20, 20);
    const broken: LooseEntity = { id: 'line_inf', type: 'line', start: { x: -Infinity, y: 0 }, end: { x: 5, y: 5 } };

    const { bounds } = normalize([broken, healthy]);

    expect(bounds.max).toEqual({ x: 10, y: 10 });
    expect(Number.isFinite(bounds.max.x)).toBe(true);
  });

  it('ΟΛΕΣ οι οντότητες μη-μετρήσιμες → καμία μετατόπιση κατά NaN (ο ένοχος μένει ΕΝΑΣ)', () => {
    const broken: LooseEntity = { id: 'point_0', type: 'point', position: { x: NaN, y: NaN } };
    const other: LooseEntity = { id: 'point_1', type: 'point', position: { x: 7, y: 9 } };

    // Το `other` είναι υγιές· το `broken` όχι. Ό,τι κι αν γίνει με τα bounds, το υγιές
    // ΔΕΝ επιτρέπεται να μολυνθεί — αυτό ήταν το πραγματικό κόστος του σφάλματος.
    normalize([broken, other]);

    expect(Number.isFinite((other.position as { x: number }).x)).toBe(true);
    expect(Number.isFinite((other.position as { y: number }).y)).toBe(true);
  });
});
