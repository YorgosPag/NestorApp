/**
 * ADR-436 Slice 1 — foundationToMesh tests (3Δ elevation hang-down formula).
 */

import { foundationToMesh } from '../foundation-to-three';
import { buildFoundationEntity, buildDefaultFoundationParams } from '../../../hooks/drawing/foundation-completion';
import type { FoundationEntity } from '../../../bim/types/foundation-types';

function makePad(topElevationMm: number, thicknessMm: number): FoundationEntity {
  const params = buildDefaultFoundationParams({ x: 0, y: 0 }, 'pad', { topElevationMm, thicknessMm });
  const r = buildFoundationEntity(params, 'layer-1');
  if (!r.ok) throw new Error('failed to build pad');
  return r.entity;
}

describe('foundationToMesh — elevation (hang-down)', () => {
  it('positions the base at (topElevation − thickness) in metres', () => {
    const mesh = foundationToMesh(makePad(-1000, 500), 0, 'level-1', 0);
    expect(mesh).not.toBeNull();
    // (-1000 − 500) · 0.001 = -1.5
    expect(mesh!.position.y).toBeCloseTo(-1.5, 5);
  });

  it('adds the building base elevation offset', () => {
    const mesh = foundationToMesh(makePad(-1000, 500), 0, 'level-1', 3);
    expect(mesh!.position.y).toBeCloseTo(1.5, 5);
  });

  it('ignores floorElevationMm (foundation elevation is absolute)', () => {
    const a = foundationToMesh(makePad(-800, 400), 0, 'l', 0);
    const b = foundationToMesh(makePad(-800, 400), 9999, 'l', 0);
    expect(a!.position.y).toBeCloseTo(b!.position.y, 5);
  });

  it('tags the mesh with bim id/type', () => {
    const pad = makePad(-1000, 500);
    const mesh = foundationToMesh(pad, 0, 'level-1', 0);
    expect(mesh!.userData['bimType']).toBe('foundation');
    expect(mesh!.userData['bimId']).toBe(pad.id);
    expect(mesh!.userData['levelId']).toBe('level-1');
  });
});
