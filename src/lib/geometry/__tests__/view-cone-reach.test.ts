/**
 * @fileoverview 📏 **Η ΑΚΤΙΝΑ ΜΕΝΕΙ ΣΤΟ ΚΟΥΤΙ** — `reachInsideBox` (ADR-897 §6, ζωντανός έλεγχος 01/10).
 * @related ../view-cone.ts
 *
 * Ρ1 — οι τέσσερις κύριες κατευθύνσεις φτάνουν ακριβώς στον τοίχο, μείον το περιθώριο;
 * Ρ2 — διαγώνια: σταματά στον **πρώτο** τοίχο που συναντά;
 * Ρ3 — σημείο ήδη μέσα στο περιθώριο ⇒ 0, ποτέ αρνητικό;
 */

import { pointAlongHeading, reachInsideBox } from '../view-cone';

const BOX = { width: 1000, height: 500 };
const ORIGIN = { x: 200, y: 100 };

describe('reachInsideBox', () => {
  it('Ρ1 — πάνω · δεξιά · κάτω · αριστερά', () => {
    expect(reachInsideBox(ORIGIN, 0, BOX, 10)).toBeCloseTo(90);
    expect(reachInsideBox(ORIGIN, Math.PI / 2, BOX, 10)).toBeCloseTo(790);
    expect(reachInsideBox(ORIGIN, Math.PI, BOX, 10)).toBeCloseTo(390);
    expect(reachInsideBox(ORIGIN, (3 * Math.PI) / 2, BOX, 10)).toBeCloseTo(190);
  });

  it('Ρ2 — διαγώνια ως τον πρώτο τοίχο, και το άκρο είναι ΠΑΝΩ του', () => {
    const heading = Math.PI / 4; // πάνω-δεξιά: ο πάνω τοίχος έρχεται πρώτος
    const reach = reachInsideBox(ORIGIN, heading, BOX);
    expect(pointAlongHeading(ORIGIN, heading, reach).y).toBeCloseTo(0);
  });

  it('Ρ3 — μέσα στο περιθώριο ⇒ μηδέν', () => {
    expect(reachInsideBox({ x: 5, y: 250 }, (3 * Math.PI) / 2, BOX, 10)).toBe(0);
  });
});
