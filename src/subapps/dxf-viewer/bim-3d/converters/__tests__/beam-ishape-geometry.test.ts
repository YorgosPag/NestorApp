/**
 * ADR-363 Φ2 — swept steel I/H beam 3D geometry.
 *
 * Επαληθεύει ότι το I-profile (b×h) σαρώνεται κατά τον άξονα στον σωστό world
 * προσανατολισμό/μονάδες (meters), ώστε `applyBeamSlope` + `mesh.position.y` να
 * μένουν συμβατά με το box path:
 *   world X = plan x · world Z = −plan y · world Y = ύψος ∈ [0, h]
 * Scene = meters (sceneUnits='m') ώστε plan/depth να είναι συνεπώς σε μέτρα.
 */

import { buildSweptIBeamGeometry } from '../beam-ishape-geometry';
import { computeBeamGeometry } from '../../../bim/geometry/beam-geometry';
import type { BeamEntity, BeamParams } from '../../../bim/types/beam-types';

function makeBeam(over: Partial<BeamParams> = {}): BeamEntity {
  const params: BeamParams = {
    kind: 'straight',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 4, y: 0, z: 0 },   // meters (sceneUnits='m')
    width: 200,
    depth: 400,
    topElevation: 3000,
    sceneUnits: 'm',
    sectionKind: 'I-shape',
    ishape: { flangeThickness: 20, webThickness: 15 },
    ...over,
  } as BeamParams;
  return {
    id: 'b',
    type: 'beam',
    kind: params.kind,
    ifcType: 'IfcBeam',
    layerId: '0',
    params,
    geometry: computeBeamGeometry(params),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as BeamEntity;
}

describe('buildSweptIBeamGeometry', () => {
  it('returns null for curved beams → box fallback', () => {
    const beam = makeBeam({ kind: 'curved', curveControl: { x: 2, y: 1, z: 0 } });
    expect(buildSweptIBeamGeometry(beam)).toBeNull();
  });

  it('returns null for a degenerate (zero-length) axis', () => {
    expect(buildSweptIBeamGeometry(makeBeam({ endPoint: { x: 0, y: 0, z: 0 } }))).toBeNull();
  });

  it('sweeps the I-profile along +X with correct world bounds (meters)', () => {
    const geo = buildSweptIBeamGeometry(makeBeam());
    expect(geo).not.toBeNull();
    geo!.computeBoundingBox();
    const bb = geo!.boundingBox!;
    // axis along world +X for 4m
    expect(bb.min.x).toBeCloseTo(0, 5);
    expect(bb.max.x).toBeCloseTo(4, 5);
    // height = depth 400mm = 0.4m, base anchored at Y=0 (box convention)
    expect(bb.min.y).toBeCloseTo(0, 5);
    expect(bb.max.y).toBeCloseTo(0.4, 5);
    // flange width = 200mm = 0.2m → ±0.1m along world Z (perpendicular)
    expect(bb.min.z).toBeCloseTo(-0.1, 5);
    expect(bb.max.z).toBeCloseTo(0.1, 5);
  });

  it('keeps the section vertical (height invariant) on a diagonal axis', () => {
    const geo = buildSweptIBeamGeometry(makeBeam({ endPoint: { x: 3, y: 4, z: 0 } })); // length 5
    expect(geo).not.toBeNull();
    geo!.computeBoundingBox();
    const bb = geo!.boundingBox!;
    expect(bb.min.y).toBeCloseTo(0, 5);
    expect(bb.max.y).toBeCloseTo(0.4, 5);
  });
});
