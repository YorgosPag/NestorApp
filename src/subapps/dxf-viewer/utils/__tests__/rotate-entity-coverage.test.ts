/**
 * Rotate capability coverage (ADR-587 Φ5 — TIER-2 cheap seam).
 *
 * Δένει το ζωντανό `ROTATE_HANDLERS` seam (`rotation-math.ts`) με το descriptor domain
 * (`RENDERABLE_ENTITY_TYPES`), ώστε να μην μπορεί να αποκλίνει σιωπηλά (mirror του
 * `entity-descriptor-coverage.test.ts`):
 *  1. Golden — ποιοι renderable types ΕΧΟΥΝ ρητή rotation υλοποίηση.
 *  2. No-op set — ποιοι renderable types πέφτουν στο `{}` default (BIM + point/dimension/
 *     hatch/xline/ray). Ασύμμετρο per-site default καρφωμένο ρητά (ADR-587 §4.6).
 *  3. Editor-only extra — ο ΜΟΝΟΣ non-renderable handler είναι το `group` (container).
 *  4/5. Behavioral pins — no-op default επιστρέφει `{}`· ένας supported τύπος όντως περιστρέφει.
 *
 * Νέος renderable τύπος → προσγειώνεται σε #1 ή #2 → σπάει το test → επιβάλλει συνειδητή
 * απόφαση (πρόσθεσε handler ή επιβεβαίωσε no-op), αντί για σιωπηλό «δεν περιστρέφεται».
 */

// Firebase auth mock — τα type barrels αγγίζουν auth στο import path (handoff trap).
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { ROTATE_SUPPORTED_TYPES, rotateEntity } from '../rotation-math';
import {
  RENDERABLE_ENTITY_TYPES,
  BIM_RENDERABLE_TYPES,
} from '../../rendering/contract/renderable-entity-type';
import type { Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();

const renderableSet = new Set<string>(RENDERABLE_ENTITY_TYPES);
const supportedSet = new Set<string>(ROTATE_SUPPORTED_TYPES);

describe('Rotate capability coverage — ζωντανό seam ↔ descriptor domain (ADR-587 Φ5)', () => {
  it('renderable types με ρητή rotation = καρφωμένο golden set', () => {
    const withRotate = RENDERABLE_ENTITY_TYPES.filter((t) => supportedSet.has(t));
    expect(asSorted(withRotate)).toEqual(
      asSorted([
        'line', 'circle', 'arc', 'polyline', 'lwpolyline', 'rectangle', 'rect',
        'ellipse', 'text', 'mtext', 'spline', 'angle-measurement', 'annotation-symbol',
      ]),
    );
  });

  it('renderable types χωρίς handler = no-op set (BIM + point/dimension/hatch/xline/ray)', () => {
    const noRotate = RENDERABLE_ENTITY_TYPES.filter((t) => !supportedSet.has(t));
    const expected = ['point', 'dimension', 'hatch', 'xline', 'ray', ...BIM_RENDERABLE_TYPES];
    expect(asSorted(noRotate)).toEqual(asSorted(expected));
  });

  it('ο ΜΟΝΟΣ non-renderable handler είναι το "group" (editor-only container)', () => {
    const nonRenderable = ROTATE_SUPPORTED_TYPES.filter((t) => !renderableSet.has(t));
    expect(nonRenderable).toEqual(['group']);
  });

  it('τύπος χωρίς handler → rotateEntity επιστρέφει {} (no-op default, per-site)', () => {
    const wall = { type: 'wall', id: 'w1', layerId: 'l1' } as unknown as Entity;
    expect(rotateEntity(wall, { x: 0, y: 0 }, 90)).toEqual({});
  });

  it('line handler περιστρέφει start+end κατά 90° CCW περί την αρχή', () => {
    const line = {
      type: 'line', id: 'x', layerId: 'l',
      start: { x: 1, y: 0 }, end: { x: 2, y: 0 },
    } as unknown as Entity;
    const r = rotateEntity(line, { x: 0, y: 0 }, 90) as { start: Point2D; end: Point2D };
    expect(r.start.x).toBeCloseTo(0);
    expect(r.start.y).toBeCloseTo(1);
    expect(r.end.x).toBeCloseTo(0);
    expect(r.end.y).toBeCloseTo(2);
  });
});
