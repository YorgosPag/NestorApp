/**
 * ADR-488 §6.1 — column→footing base continuity στο 3Δ render (flat path).
 *
 * Pin: όταν δοθεί DERIVED effective βάση χαμηλότερα από τη nominal, η κολώνα κατεβαίνει
 * (mesh.position.y πέφτει) ΚΑΙ επιμηκύνεται ίσο ποσό (geometry ύψος +drop), ώστε η ΚΟΡΥΦΗ
 * να μένει σταθερή (στατική συνέχεια — όχι μετακίνηση όλης της κολώνας). `undefined` ή
 * effective ΠΑΝΩ από τη βάση → byte-for-byte no-op.
 */

import * as THREE from 'three';
import { columnToMesh } from '../BimToThreeConverter';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import type { ColumnEntity } from '../../../bim/types/column-types';

const MM_TO_M = 1 / 1000;

function flatColumn(): ColumnEntity {
  const res = buildColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

/** Κατακόρυφο ύψος (m) του geometry bounding box ενός Mesh. */
function meshHeight(mesh: THREE.Mesh): number {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  return bb.max.y - bb.min.y;
}

/** Παγκόσμιο top (m) = position.y + τοπικό max.y. */
function worldTop(mesh: THREE.Mesh): number {
  mesh.geometry.computeBoundingBox();
  return mesh.position.y + mesh.geometry.boundingBox!.max.y;
}

describe('columnToMesh — base continuity (ADR-488 §6.1)', () => {
  // (column, floorElevationMm, levelId, buildingBaseElevationM, topProfile, baseProfile,
  //  nominalHeightMm, walls, beams, suppressFinishSkin, effectiveBaseZmm)
  const make = (effectiveBaseZmm?: number): THREE.Mesh =>
    columnToMesh(flatColumn(), 0, '0', 0, undefined, undefined, undefined, [], [], true, effectiveBaseZmm) as THREE.Mesh;

  it('effective βάση −1000 → βάση πέφτει 1m, ύψος +1m, κορυφή σταθερή', () => {
    const base = make(undefined);
    const dropped = make(-1000);

    expect(dropped.position.y).toBeCloseTo(base.position.y - 1.0, 6);
    expect(meshHeight(dropped)).toBeCloseTo(meshHeight(base) + 1.0, 6);
    expect(worldTop(dropped)).toBeCloseTo(worldTop(base), 6); // η κορυφή ΔΕΝ κουνιέται
  });

  it('undefined effective βάση → no-op (ίδιο με χωρίς continuity)', () => {
    const base = make(undefined);
    expect(make(undefined).position.y).toBeCloseTo(base.position.y, 6);
    expect(meshHeight(make(undefined))).toBeCloseTo(meshHeight(base), 6);
  });

  it('effective βάση ΠΑΝΩ από τη nominal → ποτέ δεν ανεβάζει (Math.max 0)', () => {
    const base = make(undefined);
    const above = make(500); // πάνω από τη βάση (0) → no drop
    expect(above.position.y).toBeCloseTo(base.position.y, 6);
    expect(meshHeight(above)).toBeCloseTo(meshHeight(base), 6);
  });
});
