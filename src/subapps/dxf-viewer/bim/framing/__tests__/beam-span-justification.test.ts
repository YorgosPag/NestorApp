/**
 * ADR-529 — auto-span Location-Line justification (end-to-end). Επαληθεύει ότι ο north-flush auto-span
 * επιστρέφει `justification:'right'`, και ότι το πλήρες pipeline (body axis → `unjustifyAxisPoints` →
 * location line → `computeBeamGeometry`) κρατά τη βόρεια ακμή flush ΑΚΟΜΑ και όταν ο auto-sizer στενέψει
 * το πλάτος (το αρχικό bug).
 */

import { resolveBeamSpanSnap } from '../beam-span-snap';
import { unjustifyAxisPoints } from '../../grid/axis-justify';
import { computeBeamGeometry } from '../../geometry/beam-geometry';
import type { BeamParams } from '../../types/beam-types';
import type { Point2D } from '../../../rendering/types/Types';

// Δύο όμοιες κολόνες (depth 250, βόρεια παρειά y=11250), κενό κατά X. Καθαρή συμμετρική σκηνή.
const WEST: Point2D[] = [{ x: 1000, y: 11000 }, { x: 1250, y: 11000 }, { x: 1250, y: 11250 }, { x: 1000, y: 11250 }];
const EAST: Point2D[] = [{ x: 6000, y: 11000 }, { x: 6250, y: 11000 }, { x: 6250, y: 11250 }, { x: 6000, y: 11250 }];
const NORTH_FACE = 11250;
const WIDTH_COMMIT = 250;

describe('auto-span Location-Line justification (ADR-529)', () => {
  it('cursor κοντά στη ΒΟΡΕΙΑ παρειά → north-flush → justification = "right"', () => {
    const span = resolveBeamSpanSnap({ x: 3500, y: 11240 }, [WEST, EAST], 'mm', WIDTH_COMMIT);
    expect(span).not.toBeNull();
    expect(span!.justification).toBe('right');
    // body axis north-flush: η βόρεια ακμή του σώματος (axis y + hw) = 11250.
    expect(span!.start.y + WIDTH_COMMIT / 2).toBeCloseTo(NORTH_FACE, 6);
  });

  it('cursor κοντά στη ΝΟΤΙΑ παρειά → south-flush → justification = "left"', () => {
    const span = resolveBeamSpanSnap({ x: 3500, y: 11010 }, [WEST, EAST], 'mm', WIDTH_COMMIT);
    expect(span).not.toBeNull();
    expect(span!.justification).toBe('left');
  });

  it('cursor στο ΚΕΝΤΡΟ → centered → justification = "center"', () => {
    const span = resolveBeamSpanSnap({ x: 3500, y: 11125 }, [WEST, EAST], 'mm', WIDTH_COMMIT);
    expect(span).not.toBeNull();
    expect(span!.justification).toBe('center');
  });

  it('🔴 END-TO-END: unjustify→location line→geometry κρατά βόρεια ακμή 11250 ΚΑΙ μετά τον auto-sizer', () => {
    const span = resolveBeamSpanSnap({ x: 3500, y: 11240 }, [WEST, EAST], 'mm', WIDTH_COMMIT)!;
    // mimic appendCenterlineBeam: body axis → location line (unjustify με το width commit).
    const loc = unjustifyAxisPoints(span.start, span.end, WIDTH_COMMIT, span.justification, 'mm');
    expect(loc.start.y).toBeCloseTo(NORTH_FACE, 6); // location line = βόρεια παρειά

    const base: BeamParams = {
      kind: 'straight',
      startPoint: { x: loc.start.x, y: loc.start.y, z: 0 },
      endPoint: { x: loc.end.x, y: loc.end.y, z: 0 },
      width: WIDTH_COMMIT, depth: 400, topElevation: 3000, sceneUnits: 'mm',
      justification: span.justification,
    };
    const northEdge = (p: BeamParams): number => Math.max(...computeBeamGeometry(p).outline.vertices.map((v) => v.y));

    expect(northEdge(base)).toBeCloseTo(NORTH_FACE, 6);                       // commit width 250
    expect(northEdge({ ...base, width: 200 })).toBeCloseTo(NORTH_FACE, 6);    // auto-sizer 250→200 → ΜΕΝΕΙ
    expect(northEdge({ ...base, width: 150 })).toBeCloseTo(NORTH_FACE, 6);    // ακόμα στενότερο → ΜΕΝΕΙ
  });
});
