/**
 * ADR-539 Φ3d — beamToMesh faced (per-face appearance) tests.
 *
 * Το box δοκάρι = οριζόντιο prism (plan footprint width×length, extruded κατά depth) → render
 * faced (multi-material, pickable per-face) όταν φέρει `faceAppearance` Ή είναι ο live Polygon-Mode
 * target, αλλιώς legacy single-material extrude (byte-for-byte). Το faced body έχει IDENTICAL local
 * span [0, renderHeightM] με το `extrudeAndRotate`, άρα η `position.y` (datum) ΔΕΝ αλλάζει — mirror
 * wall Φ3c / column Φ3a. MVP scope: ΜΟΝΟ box single-piece (I-shape/multi-cutback μένουν legacy).
 */

import * as THREE from 'three';
import { beamToMesh } from '../BimToThreeConverter';
import { computeBeamGeometry } from '../../../bim/geometry/beam-geometry';
import { usePolygonMode3DStore } from '../../stores/PolygonMode3DStore';
import type { BeamEntity, BeamParams } from '../../../bim/types/beam-types';
import type { FaceAppearanceMap } from '../../../bim/types/face-appearance-types';

function asMesh(o: THREE.Object3D | null): THREE.Mesh {
  if (!(o instanceof THREE.Mesh)) throw new Error('expected a THREE.Mesh');
  return o;
}

function makeBeam(faceAppearance?: FaceAppearanceMap, over: Partial<BeamParams> = {}): BeamEntity {
  const params: BeamParams = {
    kind: 'straight',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 1000, y: 0, z: 0 },
    width: 250,
    depth: 400,
    topElevation: 3000,
    sceneUnits: 'mm',
    ...over,
  } as BeamParams;
  return {
    id: 'beam-1',
    type: 'beam',
    kind: params.kind,
    ifcType: 'IfcBeam',
    layerId: '0',
    params,
    geometry: computeBeamGeometry(params),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
    ...(faceAppearance ? { faceAppearance } : {}),
  } as unknown as BeamEntity;
}

afterEach(() => usePolygonMode3DStore.getState().reset());

describe('beamToMesh — ADR-539 Φ3d faced (per-face appearance)', () => {
  it('renders a multi-material faced prism when faceAppearance carries a painted face', () => {
    const mesh = asMesh(beamToMesh(makeBeam({ top: { colorHex: '#C0392B' } })));
    expect(Array.isArray(mesh.material)).toBe(true);
    // bottom, top, side:0..n — the faceKey↔materialIndex SSoT survives onto userData.
    expect(mesh.userData['faceKeyByMaterialIndex']).toBeDefined();
    expect((mesh.userData['faceKeyByMaterialIndex'] as string[]).slice(0, 2)).toEqual(['bottom', 'top']);
  });

  it('keeps the IDENTICAL datum (position.y) as the legacy single-material path', () => {
    const legacy = asMesh(beamToMesh(makeBeam()));
    const faced = asMesh(beamToMesh(makeBeam({ 'side:0': { colorHex: '#123456' } })));
    expect(faced.position.y).toBeCloseTo(legacy.position.y, 6);
  });

  it('stays legacy single-material when faceAppearance is an empty map (byte-for-byte)', () => {
    expect(Array.isArray(asMesh(beamToMesh(makeBeam({}))).material)).toBe(false);
  });

  it('renders faced while Polygon Mode is active, even unpainted (chicken-and-egg)', () => {
    const beam = makeBeam();
    usePolygonMode3DStore.getState().setActive(true, beam.id);
    expect(Array.isArray(asMesh(beamToMesh(beam)).material)).toBe(true);
  });

  it('renders faced for ANY solid while Polygon Mode is active (Φ4b cross-entity)', () => {
    const beam = makeBeam();
    usePolygonMode3DStore.getState().setActive(true, 'some-other-id'); // another solid opened the mode
    expect(Array.isArray(asMesh(beamToMesh(beam)).material)).toBe(true);
  });

  it('stays legacy (single-material) for an I-shape steel beam even when painted (swept, ΟΧΙ prism)', () => {
    const ishape = makeBeam(
      { top: { colorHex: '#C0392B' } },
      { sectionKind: 'I-shape', ishape: { flangeThickness: 20, webThickness: 15 } } as Partial<BeamParams>,
    );
    expect(Array.isArray(asMesh(beamToMesh(ishape)).material)).toBe(false);
  });
});
