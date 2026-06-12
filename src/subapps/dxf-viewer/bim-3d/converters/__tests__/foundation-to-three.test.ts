/**
 * ADR-436 Slice 1 — foundationToMesh tests (3Δ elevation hang-down formula).
 */

import * as THREE from 'three';
import { foundationToMesh } from '../foundation-to-three';
import { buildFoundationEntity, buildDefaultFoundationParams } from '../../../hooks/drawing/foundation-completion';
import type { FoundationEntity, FoundationKind } from '../../../bim/types/foundation-types';

function makeKind(kind: FoundationKind, topElevationMm = -1000, thicknessMm = 500): FoundationEntity {
  const params = buildDefaultFoundationParams({ x: 0, y: 0 }, kind, { topElevationMm, thicknessMm });
  const r = buildFoundationEntity(params, 'layer-1');
  if (!r.ok) throw new Error(`failed to build ${kind}`);
  return r.entity;
}
const makePad = (topElevationMm: number, thicknessMm: number) => makeKind('pad', topElevationMm, thicknessMm);

/** Hex of the mesh's (single) MeshStandardMaterial face colour. */
function meshColorHex(mesh: THREE.Mesh | null): string {
  const mat = mesh!.material as THREE.MeshStandardMaterial;
  return mat.color.getHexString();
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

  // ADR-445 — per-kind sienna face material (pad/strip/tie-beam ΔΙΑΚΡΙΤΑ).
  it('gives each foundation kind a DISTINCT face colour (pad/strip/tie-beam)', () => {
    const pad = meshColorHex(foundationToMesh(makeKind('pad'), 0, 'l', 0));
    const strip = meshColorHex(foundationToMesh(makeKind('strip'), 0, 'l', 0));
    const tie = meshColorHex(foundationToMesh(makeKind('tie-beam'), 0, 'l', 0));
    expect(new Set([pad, strip, tie]).size).toBe(3);
    expect(pad).toBe('8a5a3c');  // sienna
    expect(strip).toBe('2f7d6a'); // teal
    expect(tie).toBe('b5651d');  // κεραμυδί
  });

  it('tags the mesh with bim id/type', () => {
    const pad = makePad(-1000, 500);
    const mesh = foundationToMesh(pad, 0, 'level-1', 0);
    expect(mesh!.userData['bimType']).toBe('foundation');
    expect(mesh!.userData['bimId']).toBe(pad.id);
    expect(mesh!.userData['levelId']).toBe('level-1');
  });
});
