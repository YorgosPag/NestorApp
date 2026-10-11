/**
 * ADR-911 Φ4-1 — ο λύτης της πόρτας πάνω σε συνθετικά εμπόδια: ό,τι ΔΕΝ ξεχωρίζει το σχέδιο
 * δοκιμής (εκεί ο μεντεσές κάθεται ακριβώς στην παρειά και το «άλλο άκρο» δεν βρίσκει ποτέ λαμπάδα).
 */

import type { ArcEntity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import { arcSweepDeg, solveDoorSymbol, type DoorObstacle } from '../door-symbol-axis';

const R = 800;
/** Μεντεσές στο (0,0), κλειστό φύλλο κατά +x, ανοίγει προς +y. */
const arc = (startAngle = 0, endAngle = 90): ArcEntity =>
  ({ id: 'arc', type: 'arc', center: { x: 0, y: 0 }, radius: R, startAngle, endAngle }) as unknown as ArcEntity;

const box = (x0: number, y0: number, x1: number, y1: number, wallId?: string): DoorObstacle => {
  const ring: Point2D[] = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  return { ring, wallId };
};

/** Δύο λαμπάδες κάτω από τη γραμμή του φύλλου, 50 mm πίσω από τον μεντεσέ και μπροστά από το άκρο. */
const jambs = (top = 0): DoorObstacle[] => [box(-150, -100, -50, top, 'back'), box(R + 50, -100, R + 150, top, 'front')];

describe('solveDoorSymbol', () => {
  it('κενό = λαμπάδα + φύλλο + λαμπάδα, με τον άξονα προς το κλειστό άκρο', () => {
    const result = solveDoorSymbol(arc(), jambs(), 1);
    expect(result.kind).toBe('solved');
    if (result.kind !== 'solved') return;
    expect(result.solution.gap).toBeCloseTo(R + 100, 6);
    expect([result.solution.u.x, result.solution.swing.y]).toEqual([1, 1]);
    expect([result.solution.back.obstacle.wallId, result.solution.front.obstacle.wallId]).toEqual(['back', 'front']);
  });

  it('η φορά σχεδίασης του τόξου δεν αλλάζει το αποτέλεσμα', () => {
    const forward = solveDoorSymbol(arc(0, 90), jambs(), 1);
    const reverse = solveDoorSymbol(arc(90, 0), jambs(), 1);
    expect(reverse).toEqual(forward);
  });

  it('θόρυβος σχεδίου: παρειά 0,5 mm κάτω από τη γραμμή του φύλλου βρίσκεται ακόμη', () => {
    const result = solveDoorSymbol(arc(), jambs(-0.5), 1);
    expect(result.kind === 'solved' && result.solution.gap).toBeCloseTo(R + 100, 6);
  });

  it('όταν και τα δύο άκρα βρίσκουν σώμα, κλειστό είναι εκείνο με το ΣΤΕΝΟΤΕΡΟ κενό', () => {
    const closet = [...jambs(), box(-400, -300, R + 400, -200), box(-400, R + 300, 400, R + 350)];
    const result = solveDoorSymbol(arc(), closet, 1);
    expect(result.kind === 'solved' && [result.solution.u.x, result.solution.gap]).toEqual([1, R + 100]);
  });

  it('μεντεσές μέσα σε σώμα ⇒ ο τοίχος περνά συνεχής, δεν μετριούνται λαμπάδες', () => {
    const through = box(-2000, -100, 3000, 0, 'through');
    const result = solveDoorSymbol(arc(), [through], 1);
    expect(result.kind === 'inside-body' && result.obstacle.wallId).toBe('through');
  });

  it('συνεχής τοίχος: το ΛΑΘΟΣ άκρο που ακουμπά την παρειά του δεν γίνεται πόρτα κάθετη στον τοίχο', () => {
    const through = box(-2000, -100, 3000, -0.4, 'through');
    const result = solveDoorSymbol(arc(), [through, box(-400, R + 60, 400, R + 100, 'across')], 1);
    expect(result.kind === 'inside-body' && result.obstacle.wallId).toBe('through');
  });

  it('λύση χωρίς χώρο για κάσα είναι καλύτερη από καμία (θα κριθεί «προς απόφαση»)', () => {
    const result = solveDoorSymbol(arc(), [box(-150, -100, -5, 0), box(R + 5, -100, R + 150, 0)], 1);
    expect(result.kind === 'solved' && result.solution.gap).toBeCloseTo(R + 10, 6);
  });

  it('χωρίς σώμα σε απόσταση λαμπάδας ⇒ καμία λύση', () => {
    expect(solveDoorSymbol(arc(), [box(-900, -100, -800, 0), box(R + 800, -100, R + 900, 0)], 1).kind).toBe('no-jamb');
  });

  it('τόξο που δεν είναι φύλλο (ημικύκλιο) δεν είναι πόρτα', () => {
    expect(arcSweepDeg({ startAngle: 0, endAngle: -274 })).toBe(86);
    expect(solveDoorSymbol(arc(0, 180), jambs(), 1).kind).toBe('not-a-door');
  });

  it('οι αποστάσεις ακολουθούν τις μονάδες της σκηνής', () => {
    const cm = (o: DoorObstacle): DoorObstacle => ({ ...o, ring: o.ring.map((p) => ({ x: p.x / 10, y: p.y / 10 })) });
    const small = { ...arc(), radius: R / 10 } as ArcEntity;
    const result = solveDoorSymbol(small, jambs().map(cm), 0.1);
    expect(result.kind === 'solved' && result.solution.gap).toBeCloseTo((R + 100) / 10, 6);
  });
});
