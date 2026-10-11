/**
 * ADR-911 Φ4-2 — `swing` → `handing` / `openDirection`. Κριτής δεν είναι ο πίνακας αληθείας της
 * ίδιας της συνάρτησης αλλά η ΠΡΑΓΜΑΤΙΚΗ γεωμετρία του ανοίγματος (`computeOpeningGeometry`):
 * με τα enum που βγήκαν, ο μεντεσές πρέπει να πέφτει στο `span.start` και το φύλλο να ανοίγει
 * προς το `swing` — όποια φορά κι αν έχει ο άξονας του ξενιστή.
 */

import type { Point2D } from '../../../rendering/types/Types';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import { computeOpeningGeometry } from '../../geometry/opening-geometry';
import type { OpeningParams } from '../../types/opening-types';
import type { WallEntity } from '../../types/wall-types';
import { resolveDoorSwing } from '../door-swing';

function wall(from: Point2D, to: Point2D): WallEntity {
  const built = buildWallEntity(buildDefaultWallParams(from, to, { thickness: 100 }), 'lvl', 'straight', 'mm');
  if (!built.ok) throw new Error(built.hardErrors.join(','));
  return built.entity;
}

const HINGE: Point2D = { x: 1000, y: 0 };
const LATCH: Point2D = { x: 1900, y: 0 };
const SPAN = { start: HINGE, end: LATCH };

/** Το άνοιγμα 900 mm πάνω στο x ∈ [1000, 1900], με τα enum που έδωσε η συνάρτηση. */
function geometryFor(host: WallEntity, swing: Point2D) {
  const resolved = resolveDoorSwing(host, SPAN, swing)!;
  const forward = host.params.end.x > host.params.start.x;
  const params: OpeningParams = {
    kind: 'door', wallId: host.id, width: 900, height: 2100, sillHeight: 0,
    offsetFromStart: forward ? 1000 : 4000 - 1900,
    ...resolved,
  };
  return { resolved, geometry: computeOpeningGeometry(params, host, 'mm') };
}

describe.each([
  ['άξονας κατά +x', wall({ x: 0, y: 0 }, { x: 4000, y: 0 })],
  ['άξονας κατά −x', wall({ x: 4000, y: 0 }, { x: 0, y: 0 })],
])('resolveDoorSwing — %s', (_name, host) => {
  it.each([
    ['προς +y', { x: 0, y: 1 }],
    ['προς −y', { x: 0, y: -1 }],
  ])('ο μεντεσές πέφτει στο span.start και το φύλλο ανοίγει %s', (_side, swing) => {
    const { geometry } = geometryFor(host, swing);

    expect(geometry.hingeAnchor!.x).toBeCloseTo(HINGE.x, 6);
    expect(geometry.hingeAnchor!.y).toBeCloseTo(HINGE.y, 6);
    const open = geometry.hingeArc!.points[geometry.hingeArc!.points.length - 1];
    expect(Math.sign(open.y - HINGE.y)).toBe(swing.y);
    expect(open.x).toBeCloseTo(HINGE.x, 6);
  });
});

describe('resolveDoorSwing — τα enum αλλάζουν με τη φορά του άξονα, η πόρτα όχι', () => {
  it('ίδιο σύμβολο σε αντίστροφο τοίχο ⇒ αντίστροφα ΚΑΙ τα δύο', () => {
    const forward = resolveDoorSwing(wall({ x: 0, y: 0 }, { x: 4000, y: 0 }), SPAN, { x: 0, y: 1 });
    const backward = resolveDoorSwing(wall({ x: 4000, y: 0 }, { x: 0, y: 0 }), SPAN, { x: 0, y: 1 });
    expect(forward).toEqual({ handing: 'left', openDirection: 'inward' });
    expect(backward).toEqual({ handing: 'right', openDirection: 'outward' });
  });
});
