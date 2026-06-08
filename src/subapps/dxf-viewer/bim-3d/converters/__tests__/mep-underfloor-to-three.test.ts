/**
 * ADR-408 Εύρος Β #3 — underfloor radiant-floor 3D converter tests.
 * The loop is drawn as REAL serpentine pipes (swept TubeGeometry along
 * `geometry.loopPath`) + a faint screed band, units-safe in mm / m scenes.
 */

import * as THREE from 'three';
import {
  buildUnderfloorLoopPoints,
  buildUnderfloorTubeGeometry,
  underfloorToObject3D,
} from '../mep-underfloor-to-three';
import type { Point3D } from '../../../bim/types/bim-base';
import type { MepUnderfloorEntity } from '../../../bim/types/mep-underfloor-types';

/** A small serpentine: two rows + a U-turn, scene units. */
const LOOP: Point3D[] = [
  { x: 0, y: 0, z: 0 },
  { x: 4, y: 0, z: 0 },
  { x: 4, y: 1, z: 0 },
  { x: 0, y: 1, z: 0 },
];

/** Minimal underfloor entity carrying just what the converter reads. */
function makeEntity(loopPath: readonly Point3D[], sceneUnits: 'mm' | 'm' = 'mm'): MepUnderfloorEntity {
  return {
    id: 'uf1',
    type: 'mep-underfloor',
    kind: 'hydronic-loop',
    ifcType: 'IfcSpaceHeater',
    params: {
      kind: 'hydronic-loop',
      footprint: { vertices: [{ x: -1, y: -1, z: 0 }, { x: 5, y: -1, z: 0 }, { x: 5, y: 2, z: 0 }, { x: -1, y: 2, z: 0 }] },
      pipeSpacingMm: 150,
      edgeClearanceMm: 100,
      patternType: 'boustrophedon',
      screedOffsetMm: 50,
      connectorDiameterMm: 16,
      sceneUnits,
    },
    geometry: { loopPath },
  } as unknown as MepUnderfloorEntity;
}

describe('buildUnderfloorLoopPoints', () => {
  it('maps plan (x,y) → world (x·s, worldY, -y·s)', () => {
    const pts = buildUnderfloorLoopPoints([{ x: 2, y: 3, z: 0 }], 0.5, 7);
    expect(pts[0].x).toBeCloseTo(1, 6);
    expect(pts[0].y).toBeCloseTo(7, 6); // fixed screed elevation
    expect(pts[0].z).toBeCloseTo(-1.5, 6); // plan Y (north) → world -Z
  });
});

describe('buildUnderfloorTubeGeometry', () => {
  it('returns null for fewer than two distinct points', () => {
    expect(buildUnderfloorTubeGeometry([new THREE.Vector3()], 0.008)).toBeNull();
    // two coincident points collapse to one distinct point → null.
    expect(buildUnderfloorTubeGeometry([new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 0)], 0.008)).toBeNull();
  });

  it('builds one ring per polyline vertex (WYSIWYG with the input path)', () => {
    const pts = buildUnderfloorLoopPoints(LOOP, 1, 0);
    const geo = buildUnderfloorTubeGeometry(pts, 0.008);
    expect(geo).toBeInstanceOf(THREE.BufferGeometry);
    // 6 radial segments × N rings (LOOP has 4 distinct points).
    expect(geo!.getAttribute('position').count).toBe(6 * pts.length);
    expect(geo!.getIndex()!.count).toBeGreaterThan(0);
  });
});

/** The serpentine pipe mesh inside the group (tagged with the pipe material key). */
function findPipeMesh(obj: THREE.Object3D): THREE.Mesh | undefined {
  return obj.children.find(
    (c) => c instanceof THREE.Mesh && c.userData['matId'] === 'elem-mep-underfloor-pipe',
  ) as THREE.Mesh | undefined;
}

describe('underfloorToObject3D', () => {
  it('returns a Group containing the serpentine pipe mesh', () => {
    const obj = underfloorToObject3D(makeEntity(LOOP), 0, 'lvl', 0);
    expect(obj).toBeInstanceOf(THREE.Group);
    const tubeMesh = findPipeMesh(obj!);
    expect(tubeMesh).toBeDefined();
    expect(tubeMesh!.userData['bimId']).toBe('uf1');
  });

  it('places the pipes at the screed elevation (FFL + screedOffset + base)', () => {
    // floorElevationMm=1000, screedOffsetMm=50, base=5m → ≈ 6.05 m + radius.
    const obj = underfloorToObject3D(makeEntity(LOOP), 1000, undefined, 5)!;
    const tubeMesh = findPipeMesh(obj)!;
    tubeMesh.geometry.computeBoundingBox();
    const center = tubeMesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
    expect(center.y).toBeCloseTo(6.05 + 0.008, 2); // centreline = screed + pipe radius
  });

  it('is units-safe — same loop world extent in an mm scene and an m scene', () => {
    const mmLoop = LOOP.map((p) => ({ x: p.x * 1000, y: p.y * 1000, z: 0 }));
    const objMm = underfloorToObject3D(makeEntity(mmLoop, 'mm'), 0, undefined, 0)!;
    const objM = underfloorToObject3D(makeEntity(LOOP, 'm'), 0, undefined, 0)!;
    const sizeOf = (o: THREE.Object3D) => {
      const tube = findPipeMesh(o)!;
      tube.geometry.computeBoundingBox();
      return tube.geometry.boundingBox!.getSize(new THREE.Vector3());
    };
    expect(sizeOf(objMm).x).toBeCloseTo(sizeOf(objM).x, 3);
    // ~4 m run; rounded bends cut the corners INWARD so the extent stays ≈ 4 m (+ tube radius).
    expect(sizeOf(objMm).x).toBeGreaterThan(3.5);
    expect(sizeOf(objMm).x).toBeLessThan(4.3);
  });

  it('returns the band only (no pipe) when the loop is degenerate', () => {
    const obj = underfloorToObject3D(makeEntity([{ x: 0, y: 0, z: 0 }]), 0, undefined, 0);
    expect(obj).toBeInstanceOf(THREE.Group);
    expect(findPipeMesh(obj!)).toBeUndefined();
    expect(obj!.children.length).toBe(1); // band mesh only
  });
});
