/**
 * ADR-408 Φ12 — manifoldToMesh: 3D solid placement of a point-based plumbing
 * manifold. Pins (1) the box is centred vertically on the mounting elevation
 * (floor-mounted) and (2) the footprint is units-safe — a metre-scene manifold
 * renders at the same world size as a mm-scene one (the stair scene→meters
 * pattern, NOT the fixture's latent meter-scene assumption).
 */

import * as THREE from 'three';
import { manifoldToMesh } from '../BimToThreeConverter';
import {
  buildDefaultMepManifoldParams,
  buildMepManifoldEntity,
} from '../../../hooks/drawing/mep-manifold-completion';
import type { MepManifoldEntity } from '../../../bim/types/mep-manifold-types';
import type { SceneUnits } from '../../../utils/scene-units';

const MM_TO_M = 1 / 1000;

function manifold(units: SceneUnits = 'mm', overrides = {}): MepManifoldEntity {
  const params = buildDefaultMepManifoldParams({ x: 0, y: 0 }, overrides, units);
  const res = buildMepManifoldEntity(params, '0');
  if (!res.ok) throw new Error('manifold fixture invalid');
  return res.entity;
}

function bboxSizeX(mesh: THREE.Mesh): number {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  return bb.max.x - bb.min.x;
}

describe('manifoldToMesh', () => {
  it('builds a mesh tagged as mep-manifold', () => {
    const mesh = manifoldToMesh(manifold(), 0, '0', 0);
    expect(mesh).not.toBeNull();
    expect((mesh as THREE.Mesh).userData['bimType']).toBe('mep-manifold');
  });

  it('box is centred vertically on the mounting elevation', () => {
    // defaults: mountingElevationMm=400, bodyHeightMm=60, floorElevationMm=0.
    const mesh = manifoldToMesh(manifold(), 0, '0', 0) as THREE.Mesh;
    expect(mesh.position.y).toBeCloseTo((400 - 30) * MM_TO_M, 6);
  });

  it('adds floor elevation to the placement', () => {
    const mesh = manifoldToMesh(manifold(), 3000, '0', 0) as THREE.Mesh;
    expect(mesh.position.y).toBeCloseTo((3000 + 400 - 30) * MM_TO_M, 6);
  });

  it('UNITS-SAFE: mm-scene and m-scene manifolds render the same world width', () => {
    const mmMesh = manifoldToMesh(manifold('mm'), 0, '0', 0) as THREE.Mesh;
    const mMesh = manifoldToMesh(manifold('m'), 0, '0', 0) as THREE.Mesh;
    // Default width = 400mm = 0.4m in BOTH scenes.
    expect(bboxSizeX(mmMesh)).toBeCloseTo(0.4, 4);
    expect(bboxSizeX(mMesh)).toBeCloseTo(0.4, 4);
  });

  // ADR-408 Φ14 — drainage collector (φρεάτιο) 3D grating overlay.
  describe('drainage collector grating (φρεάτιο)', () => {
    const drain = (units: SceneUnits = 'mm') =>
      manifold(units, { kind: 'drainage-collector' });

    function gratingChild(mesh: THREE.Mesh): THREE.LineSegments | undefined {
      return mesh.children.find((c): c is THREE.LineSegments => c instanceof THREE.LineSegments);
    }

    it('a water manifold has NO grating overlay', () => {
      const mesh = manifoldToMesh(manifold(), 0, '0', 0) as THREE.Mesh;
      expect(gratingChild(mesh)).toBeUndefined();
    });

    it('a drainage collector adds a LineSegments grating child', () => {
      const mesh = manifoldToMesh(drain(), 0, '0', 0) as THREE.Mesh;
      const grating = gratingChild(mesh);
      expect(grating).toBeDefined();
      // GRATING_BAR_COUNT (6) bars × 2 endpoints = 12 position vertices.
      const pos = grating!.geometry.getAttribute('position');
      expect(pos.count).toBe(12);
    });

    it('grating sits on the basin TOP face (local y = bodyHeightM)', () => {
      // drainage default bodyHeightMm = 300 → 0.3m, + tiny z-fight lift.
      const mesh = manifoldToMesh(drain(), 0, '0', 0) as THREE.Mesh;
      const pos = gratingChild(mesh)!.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        // Top face at 0.3m + a sub-millimetre anti-z-fight lift.
        expect(pos.getY(i)).toBeGreaterThanOrEqual(0.3);
        expect(pos.getY(i)).toBeLessThan(0.301);
      }
    });

    it('grating is not a pick target (basin box owns selection)', () => {
      const mesh = manifoldToMesh(drain(), 0, '0', 0) as THREE.Mesh;
      const grating = gratingChild(mesh)!;
      const hits: THREE.Intersection[] = [];
      // Disabled raycast must push nothing regardless of the ray.
      grating.raycast(new THREE.Raycaster(), hits);
      expect(hits).toHaveLength(0);
    });

    it('UNITS-SAFE: mm-scene and m-scene gratings span the same world width', () => {
      const widthOf = (m: THREE.Mesh) => {
        const g = gratingChild(m)!.geometry;
        g.computeBoundingBox();
        const bb = g.boundingBox!;
        return bb.max.x - bb.min.x;
      };
      const mmMesh = manifoldToMesh(drain('mm'), 0, '0', 0) as THREE.Mesh;
      const mMesh = manifoldToMesh(drain('m'), 0, '0', 0) as THREE.Mesh;
      expect(widthOf(mmMesh)).toBeCloseTo(widthOf(mMesh), 4);
    });
  });
});
