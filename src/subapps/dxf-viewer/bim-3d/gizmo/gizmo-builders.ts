/**
 * gizmo-builders.ts — builders for axis arrows and plane handles.
 *
 * PORTED from GenArc ADR-022 (Gizmo System). Each builder creates a visual
 * representation + invisible hitbox along the canonical +Y axis (rotated
 * externally by the factory).
 * @related ADR-402 (3D Viewport BIM Element Editing) — GenArc gizmo port.
 */

import * as THREE from 'three';
import {
  ARROW_STEM_LENGTH, ARROW_STEM_LINE_OPACITY,
  ARROW_HEAD_RADIUS, ARROW_HEAD_LENGTH,
  ARROW_NOTCH_FACTOR, ARROW_CHEVRON_SEGMENTS,
  HITBOX_RADIUS, HITBOX_LENGTH, CYLINDER_SEGMENTS,
  PLANE_SIZE, PLANE_OPACITY_DEFAULT,
  PLANE_DIAGONAL_OPACITY_FACTOR, PLANE_ARM_EXTENSION,
  GIZMO_RENDER_ORDER,
} from './gizmo-constants';

// ---------------------------------------------------------------------------
// Shared helpers (re-exported for gizmo-geometry + gizmo-handle-builders)
// ---------------------------------------------------------------------------

type MaterialOpts = {
  transparent?: boolean;
  opacity?: number;
  visible?: boolean;
  side?: THREE.Side;
};

export function makeMaterial(
  color: number,
  opts?: MaterialOpts,
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    transparent: opts?.transparent ?? false,
    opacity: opts?.opacity ?? 1,
    visible: opts?.visible ?? true,
    side: opts?.side ?? THREE.FrontSide,
  });
}

export function applyRenderOrder(obj: THREE.Object3D): void {
  obj.renderOrder = GIZMO_RENDER_ORDER;
}

export function makeLineMat(color: number): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color, depthTest: false, depthWrite: false,
  });
}

// ---------------------------------------------------------------------------
// Concave chevron geometry (revolution of kite profile around Y axis)
// ---------------------------------------------------------------------------

/**
 * Creates a concave chevron (kite) arrowhead as a surface of revolution.
 * Two joined cones sharing a wing ring:
 *   front cone: tip (point on Y-axis) → wing ring (circle at base)
 *   back cone:  wing ring → notch (point on Y-axis, concavity)
 */
function createChevronGeometry(
  radius: number,
  headLength: number,
  notchFactor: number,
  segments: number,
): THREE.BufferGeometry {
  const tipY = headLength;
  const notchY = headLength * (1 - notchFactor);
  const wingY = 0;

  // Vertices: [0] tip, [1] notch, [2..2+N-1] wing ring
  const positions: number[] = [0, tipY, 0, 0, notchY, 0];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions.push(radius * Math.cos(a), wingY, radius * Math.sin(a));
  }

  const indices: number[] = [];
  for (let i = 0; i < segments; i++) {
    const curr = 2 + i;
    const next = 2 + ((i + 1) % segments);
    indices.push(0, curr, next);   // front cone: tip → wing[i] → wing[i+1]
    indices.push(1, next, curr);   // back cone:  notch → wing[i+1] → wing[i]
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Arrow builder — Line stem + concave chevron head
// ---------------------------------------------------------------------------

export interface ArrowResult {
  group: THREE.Group;
  hitbox: THREE.Mesh;
  tipMesh: THREE.Mesh;
}

export function buildArrowAlongY(color: number): ArrowResult {
  // Stem: thin line (not cylinder)
  const stemPts = new Float32Array([0, 0, 0, 0, ARROW_STEM_LENGTH, 0]);
  const stemGeo = new THREE.BufferGeometry();
  stemGeo.setAttribute('position', new THREE.BufferAttribute(stemPts, 3));
  const stem = new THREE.Line(
    stemGeo,
    new THREE.LineBasicMaterial({
      color, depthTest: false, depthWrite: false,
      transparent: true, opacity: ARROW_STEM_LINE_OPACITY,
    }),
  );
  stem.renderOrder = GIZMO_RENDER_ORDER;

  // Head: concave chevron (two joined cones — front tip + back notch)
  const headGeo = createChevronGeometry(
    ARROW_HEAD_RADIUS, ARROW_HEAD_LENGTH,
    ARROW_NOTCH_FACTOR, ARROW_CHEVRON_SEGMENTS,
  );
  headGeo.translate(0, ARROW_STEM_LENGTH, 0);
  const head = new THREE.Mesh(headGeo, makeMaterial(color));
  applyRenderOrder(head);

  const group = new THREE.Group();
  group.add(stem, head);

  // Hitbox (invisible cylinder covering full arrow length)
  const hitGeo = new THREE.CylinderGeometry(
    HITBOX_RADIUS, HITBOX_RADIUS, HITBOX_LENGTH, CYLINDER_SEGMENTS,
  );
  hitGeo.translate(0, HITBOX_LENGTH / 2, 0);
  const hitbox = new THREE.Mesh(hitGeo, makeMaterial(0x000000, { visible: false }));
  applyRenderOrder(hitbox);

  return { group, hitbox, tipMesh: head };
}

// ---------------------------------------------------------------------------
// Plane-handle builder — outer-corner triangle + L-bracket + diagonal + arms
// ---------------------------------------------------------------------------

export interface PlaneResult {
  visual: THREE.Group;
  hitbox: THREE.Mesh;
}

export function buildPlaneHandle(color: number): PlaneResult {
  const S = PLANE_SIZE;

  // Fill triangle — right angle at OUTER corner (S,S), edges to tipA(S,0) and tipB(0,S).
  const verts = new Float32Array([S, S, 0, S, 0, 0, 0, S, 0]);
  const fillGeo = new THREE.BufferGeometry();
  fillGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  fillGeo.setIndex([0, 1, 2]);
  fillGeo.computeVertexNormals();
  const fill = new THREE.Mesh(
    fillGeo,
    makeMaterial(color, {
      transparent: true,
      opacity: PLANE_OPACITY_DEFAULT,
      side: THREE.DoubleSide,
    }),
  );
  applyRenderOrder(fill);

  // L-bracket — tipA → outer corner → tipB (two perpendicular edges of triangle)
  const bracketPts = new Float32Array([S, 0, 0, S, S, 0, 0, S, 0]);
  const bracket = new THREE.Line(
    new THREE.BufferGeometry().setAttribute(
      'position', new THREE.BufferAttribute(bracketPts, 3),
    ) as THREE.BufferGeometry,
    makeLineMat(color),
  );
  bracket.renderOrder = GIZMO_RENDER_ORDER;

  // Diagonal — inner hypotenuse tipA→tipB (faint)
  const diagPts = new Float32Array([S, 0, 0, 0, S, 0]);
  const diagonal = new THREE.Line(
    new THREE.BufferGeometry().setAttribute(
      'position', new THREE.BufferAttribute(diagPts, 3),
    ) as THREE.BufferGeometry,
    new THREE.LineBasicMaterial({
      color, depthTest: false, depthWrite: false,
      transparent: true, opacity: PLANE_DIAGONAL_OPACITY_FACTOR,
    }),
  );
  diagonal.renderOrder = GIZMO_RENDER_ORDER;

  // Arm extensions — past tips, away from triangle toward axis stems
  const ext = PLANE_ARM_EXTENSION;
  const extAPts = new Float32Array([S, 0, 0, S, -ext, 0]);
  const extBPts = new Float32Array([0, S, 0, -ext, S, 0]);
  const extA = new THREE.Line(
    new THREE.BufferGeometry().setAttribute(
      'position', new THREE.BufferAttribute(extAPts, 3),
    ) as THREE.BufferGeometry,
    makeLineMat(color),
  );
  extA.renderOrder = GIZMO_RENDER_ORDER;
  const extB = new THREE.Line(
    new THREE.BufferGeometry().setAttribute(
      'position', new THREE.BufferAttribute(extBPts, 3),
    ) as THREE.BufferGeometry,
    makeLineMat(color),
  );
  extB.renderOrder = GIZMO_RENDER_ORDER;

  const visual = new THREE.Group();
  visual.add(fill, bracket, diagonal, extA, extB);

  // Hitbox — slightly larger triangle (same outer-corner orientation)
  const hs = S * 1.3;
  const hitVerts = new Float32Array([hs, hs, 0, hs, 0, 0, 0, hs, 0]);
  const hitGeo = new THREE.BufferGeometry();
  hitGeo.setAttribute('position', new THREE.BufferAttribute(hitVerts, 3));
  hitGeo.setIndex([0, 1, 2]);
  const hitbox = new THREE.Mesh(
    hitGeo,
    makeMaterial(0x000000, { visible: false, side: THREE.DoubleSide }),
  );
  applyRenderOrder(hitbox);

  return { visual, hitbox };
}
