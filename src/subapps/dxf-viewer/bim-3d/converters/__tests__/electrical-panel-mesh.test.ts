/**
 * ADR-408 Φ3 — panelToMesh: 3D solid placement of a point-based electrical panel.
 *
 * Pins (1) the box is centred vertically on the mounting elevation (wall-mounted)
 * and (2) the footprint is units-safe — a metre-scene panel renders at the same
 * world size as a mm-scene panel (the StairToThreeConverter scene→meters pattern,
 * NOT the fixture's latent meter-scene assumption).
 */

import * as THREE from 'three';
import { panelToMesh } from '../BimToThreeConverter';
import { buildDefaultElectricalPanelParams, buildElectricalPanelEntity } from '../../../hooks/drawing/electrical-panel-completion';
import type { ElectricalPanelEntity } from '../../../bim/types/electrical-panel-types';
import type { SceneUnits } from '../../../utils/scene-units';

const MM_TO_M = 1 / 1000;

function panel(units: SceneUnits = 'mm', overrides = {}): ElectricalPanelEntity {
  // The click point is expressed in scene units; the geometry then carries it.
  const point = units === 'm' ? { x: 0, y: 0 } : { x: 0, y: 0 };
  const params = buildDefaultElectricalPanelParams(point, overrides, units);
  const res = buildElectricalPanelEntity(params, '0');
  if (!res.ok) throw new Error('panel fixture invalid');
  return res.entity;
}

function bboxSizeX(mesh: THREE.Mesh): number {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  return bb.max.x - bb.min.x;
}

describe('panelToMesh', () => {
  it('builds a mesh tagged as electrical-panel', () => {
    const mesh = panelToMesh(panel(), 0, '0', 0);
    expect(mesh).not.toBeNull();
    expect((mesh as THREE.Mesh).userData['bimType']).toBe('electrical-panel');
  });

  it('box is centred vertically on the mounting elevation', () => {
    // defaults: mountingElevationMm=1500, bodyHeightMm=700, floorElevationMm=0.
    const mesh = panelToMesh(panel(), 0, '0', 0) as THREE.Mesh;
    // base Y = (1500 - 700/2) mm.
    expect(mesh.position.y).toBeCloseTo((1500 - 350) * MM_TO_M, 6);
  });

  it('adds floor elevation to the placement', () => {
    const mesh = panelToMesh(panel(), 3000, '0', 0) as THREE.Mesh;
    expect(mesh.position.y).toBeCloseTo((3000 + 1500 - 350) * MM_TO_M, 6);
  });

  it('UNITS-SAFE: mm-scene and m-scene panels render the same world width', () => {
    const mmMesh = panelToMesh(panel('mm'), 0, '0', 0) as THREE.Mesh;
    const mMesh = panelToMesh(panel('m'), 0, '0', 0) as THREE.Mesh;
    // Default width = 600mm = 0.6m in BOTH scenes.
    expect(bboxSizeX(mmMesh)).toBeCloseTo(0.6, 4);
    expect(bboxSizeX(mMesh)).toBeCloseTo(0.6, 4);
  });

  it('returns null for a degenerate footprint', () => {
    const bad = { ...panel(), geometry: { ...panel().geometry, footprint: { vertices: [] } } } as ElectricalPanelEntity;
    expect(panelToMesh(bad, 0, '0', 0)).toBeNull();
  });
});
