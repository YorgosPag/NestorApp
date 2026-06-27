/**
 * ADR-539 Φ3a — columnToMesh faced (per-face appearance) tests.
 *
 * Η κολώνα = ΚΑΤΑΚΟΡΥΦΟ prism → render faced (multi-material, pickable per-face) όταν
 * φέρει `faceAppearance` Ή είναι ο live Polygon-Mode target, αλλιώς legacy single-material
 * extrude (byte-for-byte). Το faced prism έχει IDENTICAL local span [0, height] με το
 * `extrudeAndRotate`, άρα η `position.y` (datum) ΔΕΝ αλλάζει — mirror foundation Φ1.5.
 */

import * as THREE from 'three';
import { columnToMesh } from '../BimToThreeConverter';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import { usePolygonMode3DStore } from '../../stores/PolygonMode3DStore';
import type { ColumnEntity } from '../../../bim/types/column-types';

function flatColumn(): ColumnEntity {
  const res = buildColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

/** Core mesh (suppressFinishSkin=true → χωρίς σοβά/group, ο πυρήνας επιστρέφεται σκέτος). */
function coreMesh(column: ColumnEntity): THREE.Mesh {
  return columnToMesh(column, 0, '0', 0, undefined, undefined, undefined, [], [], true) as THREE.Mesh;
}

afterEach(() => usePolygonMode3DStore.getState().reset());

describe('columnToMesh — ADR-539 Φ3a faced (per-face appearance)', () => {
  it('renders a multi-material faced prism when faceAppearance carries a painted face', () => {
    const painted = { ...flatColumn(), faceAppearance: { top: { colorHex: '#C0392B' } } } as ColumnEntity;
    const mesh = coreMesh(painted);
    expect(Array.isArray(mesh.material)).toBe(true);
    // bottom, top, side:0..n — the faceKey↔materialIndex SSoT survives onto userData.
    expect(mesh.userData['faceKeyByMaterialIndex']).toBeDefined();
    expect((mesh.userData['faceKeyByMaterialIndex'] as string[]).slice(0, 2)).toEqual(['bottom', 'top']);
  });

  it('keeps the IDENTICAL datum (position.y) as the legacy single-material path', () => {
    const faced = { ...flatColumn(), faceAppearance: { 'side:0': { colorHex: '#123456' } } } as ColumnEntity;
    const legacy = coreMesh(flatColumn());
    const mesh = coreMesh(faced);
    expect(mesh.position.y).toBeCloseTo(legacy.position.y, 6);
  });

  it('stays legacy single-material when faceAppearance is an empty map (byte-for-byte)', () => {
    const empty = { ...flatColumn(), faceAppearance: {} } as ColumnEntity;
    expect(Array.isArray(coreMesh(empty).material)).toBe(false);
  });

  it('renders faced when it is the live Polygon-Mode target even without paint (chicken-and-egg)', () => {
    const column = flatColumn();
    usePolygonMode3DStore.getState().setActive(true, column.id);
    expect(Array.isArray(coreMesh(column).material)).toBe(true);
  });

  it('stays legacy when a DIFFERENT solid is the Polygon-Mode target', () => {
    const column = flatColumn();
    usePolygonMode3DStore.getState().setActive(true, 'some-other-id');
    expect(Array.isArray(coreMesh(column).material)).toBe(false);
  });
});
