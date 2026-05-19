/**
 * DxfFloorPlanOverlay — converts a DxfScene into a flat THREE.LineSegments
 * sitting at Y=0 in the 3D scene (Revit-style "Underlay").
 *
 * Coordinate mapping:  DXF X → Three.js X,  DXF Y → Three.js -Z (Y-up world).
 * Entities rendered:   line, circle, arc, polyline.  Text/BIM wrappers skipped.
 *
 * ADR-366 Phase 2 (DXF floor plan underlay). Owned by ThreeJsSceneManager.
 */

import * as THREE from 'three';
import type { DxfScene, DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';

const CIRCLE_SEGMENTS = 64;
const ARC_SEGMENTS_FULL = 64;
const DEG2RAD = Math.PI / 180;

// Shared material — lightweight, never disposed (module lifetime).
const OVERLAY_MAT = new THREE.LineBasicMaterial({
  color: 0x89cff0,
  transparent: true,
  opacity: 0.5,
});

// DXF viewer entities are stored in the canvas world coordinate system (meters),
// matching BimToThreeConverter's output. No unit conversion needed — scale=1.
// NOTE: dxfScene.units reflects the DXF INSUNITS header, but our canvas always
// normalizes to meters internally, so unitScale() is intentionally NOT applied here.
const DXF_WORLD_SCALE = 1;

function pushSeg(
  buf: number[],
  ax: number, az: number,
  bx: number, bz: number,
): void {
  buf.push(ax, 0, az, bx, 0, bz);
}

function buildPositions(entities: DxfEntityUnion[], s: number): Float32Array {
  const buf: number[] = [];

  for (const entity of entities) {
    switch (entity.type) {
      case 'line': {
        pushSeg(
          buf,
          entity.start.x * s, -entity.start.y * s,
          entity.end.x * s, -entity.end.y * s,
        );
        break;
      }

      case 'circle': {
        const cx = entity.center.x * s;
        const cz = -entity.center.y * s;
        const r = entity.radius * s;
        for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
          const a0 = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
          const a1 = ((i + 1) / CIRCLE_SEGMENTS) * Math.PI * 2;
          pushSeg(
            buf,
            cx + Math.cos(a0) * r, cz - Math.sin(a0) * r,
            cx + Math.cos(a1) * r, cz - Math.sin(a1) * r,
          );
        }
        break;
      }

      case 'arc': {
        const cx = entity.center.x * s;
        const cz = -entity.center.y * s;
        const r = entity.radius * s;
        const startRad = entity.startAngle * DEG2RAD;
        const endRad = entity.endAngle * DEG2RAD;
        // Default DXF arc direction is CCW; entity.counterclockwise=false → CW
        const ccw = entity.counterclockwise !== false;
        let sweep = endRad - startRad;
        if (ccw) {
          if (sweep <= 0) sweep += Math.PI * 2;
        } else {
          if (sweep >= 0) sweep -= Math.PI * 2;
        }
        const segs = Math.max(4, Math.round(
          Math.abs(sweep) / (Math.PI * 2) * ARC_SEGMENTS_FULL,
        ));
        for (let i = 0; i < segs; i++) {
          const a0 = startRad + sweep * (i / segs);
          const a1 = startRad + sweep * ((i + 1) / segs);
          pushSeg(
            buf,
            cx + Math.cos(a0) * r, cz - Math.sin(a0) * r,
            cx + Math.cos(a1) * r, cz - Math.sin(a1) * r,
          );
        }
        break;
      }

      case 'polyline': {
        const verts = entity.vertices;
        if (verts.length < 2) break;
        const count = entity.closed ? verts.length : verts.length - 1;
        for (let i = 0; i < count; i++) {
          const a = verts[i];
          const b = verts[(i + 1) % verts.length];
          pushSeg(
            buf,
            a.x * s, -a.y * s,
            b.x * s, -b.y * s,
          );
        }
        break;
      }

      // Skip: text, dimension, slab, opening, stair, xline, ray wrappers
      default:
        break;
    }
  }

  return new Float32Array(buf);
}

export class DxfFloorPlanOverlay {
  private mesh: THREE.LineSegments | null = null;
  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  sync(dxfScene: DxfScene | null): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
    if (!dxfScene || dxfScene.entities.length === 0) return;

    const positions = buildPositions(dxfScene.entities, DXF_WORLD_SCALE);
    if (positions.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.mesh = new THREE.LineSegments(geo, OVERLAY_MAT);
    this.scene.add(this.mesh);
  }

  /** Returns world-space bounding box of the overlay, or null if no mesh. */
  getBounds(): THREE.Box3 | null {
    if (!this.mesh) return null;
    const box = new THREE.Box3();
    box.setFromObject(this.mesh);
    return box;
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
  }
}
