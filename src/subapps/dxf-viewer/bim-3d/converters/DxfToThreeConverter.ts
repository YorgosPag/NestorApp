/**
 * DxfToThreeConverter — SPEC-3D-001 (ADR-366 Phase 3).
 *
 * Converts DxfScene entities into Three.js geometry for the 3D viewport.
 * Supersedes DxfFloorPlanOverlay (single-color MVP, no layer colors).
 *
 * Strategy:
 *   Groups entities by resolved color — one LineSegments per unique color.
 *   BIM wrappers (wall / beam / slab / stair / dimension) are skipped;
 *   they are rendered by BimSceneLayer + BimToThreeConverter.
 *   Coordinate mapping: DXF (x, y) → Three.js (x, 0, −y) [Y-up, floor plane].
 *
 * Color cascade per entity:
 *   colorTrueColor > colorAci > concrete entity.color > ByLayer cascade:
 *   layer.colorTrueColor > layer.colorAci > layer.color hex > 0xffffff.
 *
 * Lifecycle: owned by ThreeJsSceneManager. sync() called on scene changes;
 * dispose() on component unmount.
 */

import * as THREE from 'three';
import type { DxfScene, DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneLayer } from '../../types/entities';
import { ACI_PALETTE } from '../../settings/standards/aci';

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_COLOR = 0xffffff;
const CIRCLE_SEGMENTS = 48;
const ARC_SEGMENTS_FULL = 48;
const DEG2RAD = Math.PI / 180;
const WIREFRAME_OPACITY = 0.65;

// ACI_PALETTE values are CSS hex strings '#RRGGBB'. Cast for numeric index access.
const ACI_MAP = ACI_PALETTE as unknown as Record<number, string | undefined>;

// ── Color helpers ─────────────────────────────────────────────────────────────

function aciToInt(aci: number): number {
  const hex = ACI_MAP[aci];
  if (!hex) return DEFAULT_COLOR;
  return parseInt(hex.slice(1), 16);
}

function hexCssToInt(hex: string): number {
  const v = parseInt(hex.startsWith('#') ? hex.slice(1) : hex, 16);
  return isNaN(v) ? DEFAULT_COLOR : v;
}

function resolveLayer(
  entity: DxfEntityUnion,
  layersById: Record<string, SceneLayer> | undefined,
): SceneLayer | undefined {
  // ADR-358 Phase 9D-5a: id-only resolution (entity-layer-id-canonical SSoT).
  // Legacy `entity.layer` name backref forbidden in new code.
  if (!layersById || !entity.layerId) return undefined;
  return layersById[entity.layerId];
}

function layerColorToInt(layer: SceneLayer): number {
  if (layer.colorTrueColor != null) return layer.colorTrueColor & 0xFFFFFF;
  if (layer.colorAci !== undefined) return aciToInt(layer.colorAci);
  if (layer.color) return hexCssToInt(layer.color);
  return DEFAULT_COLOR;
}

/** Resolve final Three.js color integer for a DXF entity.
 *  Exported for unit testing. */
export function resolveEntityColor(
  entity: DxfEntityUnion,
  layersById: Record<string, SceneLayer> | undefined,
): number {
  if (entity.colorTrueColor != null) return entity.colorTrueColor & 0xFFFFFF;

  const byLayer = entity.colorMode === 'ByLayer'
    || entity.colorMode === 'ByBlock'
    || (!entity.color && entity.colorAci === undefined);

  if (!byLayer) {
    if (entity.colorAci !== undefined) return aciToInt(entity.colorAci);
    if (entity.color) return hexCssToInt(entity.color);
  }

  const layer = resolveLayer(entity, layersById);
  return layer ? layerColorToInt(layer) : DEFAULT_COLOR;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function pushSeg(buf: number[], ax: number, az: number, bx: number, bz: number): void {
  buf.push(ax, 0, az, bx, 0, bz);
}

/** Append line-segment pairs for a single entity into a flat position buffer.
 *  Coordinate mapping: DXF x → X, DXF y → −Z (Y-up floor plane).
 *  Exported for unit testing. */
export function appendEntitySegments(buf: number[], entity: DxfEntityUnion): void {
  switch (entity.type) {
    case 'line': {
      pushSeg(buf, entity.start.x, -entity.start.y, entity.end.x, -entity.end.y);
      break;
    }

    case 'circle': {
      const { center, radius } = entity;
      for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
        const a0 = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
        const a1 = ((i + 1) / CIRCLE_SEGMENTS) * Math.PI * 2;
        pushSeg(
          buf,
          center.x + Math.cos(a0) * radius, -(center.y + Math.sin(a0) * radius),
          center.x + Math.cos(a1) * radius, -(center.y + Math.sin(a1) * radius),
        );
      }
      break;
    }

    case 'arc': {
      const { center, radius, startAngle, endAngle } = entity;
      const startRad = startAngle * DEG2RAD;
      const endRad = endAngle * DEG2RAD;
      const ccw = entity.counterclockwise !== false;
      let sweep = endRad - startRad;
      if (ccw) {
        if (sweep <= 0) sweep += Math.PI * 2;
      } else {
        if (sweep >= 0) sweep -= Math.PI * 2;
      }
      const segs = Math.max(4, Math.round(
        (Math.abs(sweep) / (Math.PI * 2)) * ARC_SEGMENTS_FULL,
      ));
      for (let i = 0; i < segs; i++) {
        const a0 = startRad + sweep * (i / segs);
        const a1 = startRad + sweep * ((i + 1) / segs);
        pushSeg(
          buf,
          center.x + Math.cos(a0) * radius, -(center.y + Math.sin(a0) * radius),
          center.x + Math.cos(a1) * radius, -(center.y + Math.sin(a1) * radius),
        );
      }
      break;
    }

    case 'polyline': {
      const { vertices, closed } = entity;
      if (vertices.length < 2) break;
      const count = closed ? vertices.length : vertices.length - 1;
      for (let i = 0; i < count; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        pushSeg(buf, a.x, -a.y, b.x, -b.y);
      }
      break;
    }

    // BIM: wall/beam/slab → BimSceneLayer; text/stair/dimension/xline/ray/others → skip.
    default:
      break;
  }
}

// ── DxfToThreeConverter ───────────────────────────────────────────────────────

export class DxfToThreeConverter {
  private readonly scene: THREE.Scene;
  private group: THREE.Group | null = null;
  private readonly activeMaterials: THREE.LineBasicMaterial[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  sync(dxfScene: DxfScene | null): void {
    this.disposeGroup();
    if (!dxfScene || dxfScene.entities.length === 0) return;

    const layersById = dxfScene.layersById as Record<string, SceneLayer> | undefined;
    const colorBuckets = new Map<number, number[]>();

    for (const entity of dxfScene.entities) {
      if (!entity.visible) continue;
      const color = resolveEntityColor(entity, layersById);
      let bucket = colorBuckets.get(color);
      if (!bucket) {
        bucket = [];
        colorBuckets.set(color, bucket);
      }
      appendEntitySegments(bucket, entity);
    }

    if (colorBuckets.size === 0) return;

    const group = new THREE.Group();
    group.name = 'dxf-wireframe';

    for (const [color, positions] of colorBuckets) {
      if (positions.length === 0) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: WIREFRAME_OPACITY });
      this.activeMaterials.push(mat);
      group.add(new THREE.LineSegments(geo, mat));
    }

    if (group.children.length === 0) return;
    this.group = group;
    this.scene.add(group);
  }

  getBounds(): THREE.Box3 | null {
    if (!this.group) return null;
    const box = new THREE.Box3().setFromObject(this.group);
    return box.isEmpty() ? null : box;
  }

  private disposeGroup(): void {
    if (!this.group) return;
    for (const child of this.group.children) {
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
      }
    }
    for (const mat of this.activeMaterials) mat.dispose();
    this.activeMaterials.length = 0;
    this.scene.remove(this.group);
    this.group = null;
  }

  dispose(): void {
    this.disposeGroup();
  }
}
