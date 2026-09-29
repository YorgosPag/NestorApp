/**
 * ADR-884 Φ2στ-γ Γ3γ-2β — οι τρεις πράξεις του επεξεργαστή πολυγώνου (σύρε · σπάσε ακμή · σβήσε), ΕΝΑ σπίτι για τον επεξεργαστή
 * χώρων της περιήγησης και τις λαβές BIM του dxf-viewer (`polygon-outline-grip-core`, που τις καλεί).
 */

import { RING_MIN_VERTICES, insertRingVertex, moveRingVertex, removeRingVertex, ringEdgeMidpoint } from '../ring-edit';

const SQUARE = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];

describe('ring-edit', () => {
  it('μετακίνηση: αλλάζει ΜΟΝΟ την κορυφή, κρατά το `z`, και δεν αγγίζει το αρχικό', () => {
    const ring = [{ x: 0, y: 0, z: 7 }, { x: 4, y: 0, z: 7 }, { x: 4, y: 4, z: 7 }];
    const next = moveRingVertex(ring, 1, { x: 5, y: -1 });
    expect(next).toEqual([{ x: 0, y: 0, z: 7 }, { x: 5, y: -1, z: 7 }, { x: 4, y: 4, z: 7 }]);
    expect(ring[1]).toEqual({ x: 4, y: 0, z: 7 });
    expect(next?.[0]).not.toBe(ring[0]);
  });

  it('μετακίνηση στην ΙΔΙΑ θέση ή σε δείκτη που λείπει ⇒ `null` (ο καλών κρατά την ίδια αναφορά)', () => {
    expect(moveRingVertex(SQUARE, 2, { x: 4, y: 4 })).toBeNull();
    expect(moveRingVertex(SQUARE, 4, { x: 1, y: 1 })).toBeNull();
    expect(moveRingVertex(SQUARE, -1, { x: 1, y: 1 })).toBeNull();
  });

  it('προσθήκη: η νέα κορυφή μπαίνει ΜΕΤΑ την κορυφή της ακμής — και στην ακμή που κλείνει τον δακτύλιο', () => {
    expect(insertRingVertex(SQUARE, 0, { x: 2, y: -1 })).toEqual([
      { x: 0, y: 0 }, { x: 2, y: -1 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 },
    ]);
    expect(insertRingVertex(SQUARE, 3, { x: -1, y: 2 })?.at(-1)).toEqual({ x: -1, y: 2 });
    expect(insertRingVertex(SQUARE, 4, { x: 0, y: 0 })).toBeNull();
    expect(insertRingVertex(SQUARE, -1, { x: 0, y: 0 })).toBeNull();
  });

  it('αφαίρεση: σβήνει την κορυφή · ΠΟΤΕ κάτω από τρεις', () => {
    expect(removeRingVertex(SQUARE, 1)).toEqual([{ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }]);
    expect(RING_MIN_VERTICES).toBe(3);
    expect(removeRingVertex(SQUARE.slice(0, 3), 0)).toBeNull();
    expect(removeRingVertex(SQUARE, 4)).toBeNull();
  });

  it('μέσο ακμής — και της ακμής που κλείνει τον δακτύλιο', () => {
    expect(ringEdgeMidpoint(SQUARE, 1)).toEqual({ x: 4, y: 2 });
    expect(ringEdgeMidpoint(SQUARE, 3)).toEqual({ x: 0, y: 2 });
  });
});
