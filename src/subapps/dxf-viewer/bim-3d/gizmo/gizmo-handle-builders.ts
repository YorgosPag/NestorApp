/**
 * gizmo-handle-builders.ts — builders for resize handles, center pyramid, reticle.
 *
 * PORTED from GenArc ADR-022 (Gizmo System).
 * @related ADR-402 (3D Viewport BIM Element Editing) — GenArc gizmo port.
 */

import * as THREE from 'three';
import {
  PYRAMID_TIP_LEN, PYRAMID_BASE_OFF, PYRAMID_BASE_R, PYRAMID_FACE_OPACITIES,
  RESIZE_OCTA_RADIUS, RESIZE_HITBOX_SIZE, RESIZE_CORNER_HITBOX_SIZE,
  RESIZE_BRACKET_SCALE, RESIZE_BRACKET_ARM_FRAC,
  RESIZE_TICK_COUNT, RESIZE_TICK_SPACING,
  RESIZE_TICK_HALF_MAJOR, RESIZE_TICK_HALF_MINOR,
  RESIZE_MIRROR_COLOR,
  GIZMO_RENDER_ORDER,
  ENDPOINT_RING_RADIUS, ENDPOINT_RING_TUBE, ENDPOINT_HITBOX_SIZE,
} from './gizmo-constants';
import {
  makeMaterial, applyRenderOrder, makeLineMat,
} from './gizmo-builders';

// ---------------------------------------------------------------------------
// Resize-handle -- wireframe octahedron + corner L-brackets + crosshair
// ---------------------------------------------------------------------------

export interface ResizeResult {
  visual: THREE.Group;
  hitbox: THREE.Mesh;
  cornerHitboxes: {
    readonly normal: readonly THREE.Mesh[];
    readonly mirror: readonly THREE.Mesh[];
  };
}

export function buildResizeHandle(color: number): ResizeResult {
  const R = RESIZE_OCTA_RADIUS * 1.18;
  const visual = new THREE.Group();

  // 1. Central glyph: square frame + short inner cross (no endpoints at frame corners)
  const sq = R * 1.05;
  const framePts = new Float32Array([
     0, 0, -sq,   sq, 0,  0,
     sq, 0,  0,   0, 0,  sq,
     0, 0,  sq,  -sq, 0,  0,
    -sq, 0,  0,   0, 0, -sq,
  ]);
  const frameGeo = new THREE.BufferGeometry();
  frameGeo.setAttribute('position', new THREE.BufferAttribute(framePts, 3));
  const frame = new THREE.LineSegments(frameGeo, makeLineMat(color));
  frame.renderOrder = GIZMO_RENDER_ORDER;
  (frame.material as THREE.LineBasicMaterial).transparent = true;
  (frame.material as THREE.LineBasicMaterial).opacity = 0.78;
  frame.userData['billboardPart'] = true;
  frame.userData['centerGlyphPart'] = true;
  visual.add(frame);

  // Active-only semi-transparent gold fill inside the frame.
  const fillR = sq * 0.98;
  const fillGeo = new THREE.BufferGeometry();
  fillGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, -fillR,
    fillR, 0, 0,
    0, 0, fillR,
    -fillR, 0, 0,
  ]), 3));
  fillGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const frameFill = new THREE.Mesh(
    fillGeo,
    makeMaterial(color, { transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
  );
  frameFill.renderOrder = GIZMO_RENDER_ORDER;
  frameFill.visible = false;
  frameFill.userData['billboardPart'] = true;
  frameFill.userData['centerGlyphPart'] = true;
  frameFill.userData['centerGlyphFill'] = true;
  visual.add(frameFill);

  const d = sq * 0.58;
  const crossPts = new Float32Array([
    -d, 0,  0,   d, 0,  0,
     0, 0, -d,   0, 0,  d,
  ]);
  const crossGeo = new THREE.BufferGeometry();
  crossGeo.setAttribute('position', new THREE.BufferAttribute(crossPts, 3));
  const cross = new THREE.LineSegments(crossGeo, makeLineMat(color));
  cross.renderOrder = GIZMO_RENDER_ORDER;
  (cross.material as THREE.LineBasicMaterial).transparent = true;
  (cross.material as THREE.LineBasicMaterial).opacity = 0.82;
  cross.userData['billboardPart'] = true;
  cross.userData['centerGlyphPart'] = true;
  visual.add(cross);

  // 2. Corner L-brackets at 4 corners; one diagonal uses mirror color
  const br = R * RESIZE_BRACKET_SCALE * 1.3;
  const armEnd = br * Math.min(RESIZE_BRACKET_ARM_FRAC, 0.42);

  const corners = [
    { id: 'tr', x: +br, z: -br, sx: +1, sz: -1, mirror: false },
    { id: 'bl', x: -br, z: +br, sx: -1, sz: +1, mirror: false },
    { id: 'tl', x: -br, z: -br, sx: -1, sz: -1, mirror: true },
    { id: 'br', x: +br, z: +br, sx: +1, sz: +1, mirror: true },
  ] as const;

  const normalCornerHitboxes: THREE.Mesh[] = [];
  const mirrorCornerHitboxes: THREE.Mesh[] = [];

  for (const c of corners) {
    const bracketColor = c.mirror ? RESIZE_MIRROR_COLOR : color;
    const pts = new Float32Array([
      c.x, 0, c.z,   c.sx * armEnd, 0, c.z,
      c.x, 0, c.z,   c.x, 0, c.sz * armEnd,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const seg = new THREE.LineSegments(geo, makeLineMat(bracketColor));
    seg.renderOrder = GIZMO_RENDER_ORDER;
    (seg.material as THREE.LineBasicMaterial).transparent = true;
    (seg.material as THREE.LineBasicMaterial).opacity = 0.72;
    seg.userData['billboardPart'] = true;
    seg.userData['mirrorPart'] = c.mirror;
    seg.userData['cornerBracket'] = true;
    seg.userData['cornerId'] = c.id;
    visual.add(seg);

    const armLen = Math.abs(c.x - c.sx * armEnd);
    const thick = R * 0.15;

    const hx = new THREE.Mesh(
      new THREE.BoxGeometry(armLen, thick, thick),
      makeMaterial(bracketColor, { transparent: true, opacity: 0.95 }),
    );
    hx.position.set((c.x + c.sx * armEnd) * 0.5, 0, c.z);
    hx.visible = false;
    hx.renderOrder = GIZMO_RENDER_ORDER + 1;
    hx.userData['billboardPart'] = true;
    hx.userData['mirrorPart'] = c.mirror;
    hx.userData['cornerThick'] = true;
    hx.userData['cornerId'] = c.id;
    visual.add(hx);

    const hz = new THREE.Mesh(
      new THREE.BoxGeometry(thick, thick, armLen),
      makeMaterial(bracketColor, { transparent: true, opacity: 0.95 }),
    );
    hz.position.set(c.x, 0, (c.z + c.sz * armEnd) * 0.5);
    hz.visible = false;
    hz.renderOrder = GIZMO_RENDER_ORDER + 1;
    hz.userData['billboardPart'] = true;
    hz.userData['mirrorPart'] = c.mirror;
    hz.userData['cornerThick'] = true;
    hz.userData['cornerId'] = c.id;
    visual.add(hz);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.14, 10, 10),
      makeMaterial(bracketColor, { transparent: true, opacity: 0.95 }),
    );
    cap.position.set(c.x, 0, c.z);
    cap.visible = false;
    cap.renderOrder = GIZMO_RENDER_ORDER + 2;
    cap.userData['billboardPart'] = true;
    cap.userData['mirrorPart'] = c.mirror;
    cap.userData['cornerCap'] = true;
    cap.userData['cornerId'] = c.id;
    visual.add(cap);

    const cornerHit = new THREE.Mesh(
      new THREE.BoxGeometry(RESIZE_CORNER_HITBOX_SIZE, RESIZE_CORNER_HITBOX_SIZE, RESIZE_CORNER_HITBOX_SIZE),
      makeMaterial(0x000000, { visible: false }),
    );
    cornerHit.position.set(c.x, 0, c.z);
    cornerHit.userData['cornerId'] = c.id;
    cornerHit.userData['mirrorPart'] = c.mirror;
    cornerHit.userData['isResizeCornerHit'] = true;
    applyRenderOrder(cornerHit);

    if (c.mirror) mirrorCornerHitboxes.push(cornerHit);
    else normalCornerHitboxes.push(cornerHit);
  }

  // 3. Tick marks along Y axis (2 per side idle)
  const tickPts: number[] = [];
  const spacing = R * RESIZE_TICK_SPACING;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 1; i <= RESIZE_TICK_COUNT; i++) {
      const y = side * (R + spacing * i);
      const half = R * (i === 1 ? RESIZE_TICK_HALF_MAJOR : RESIZE_TICK_HALF_MINOR);
      tickPts.push(-half, y, 0, half, y, 0);
    }
  }
  const tickGeo = new THREE.BufferGeometry();
  tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPts, 3));
  const ticks = new THREE.LineSegments(
    tickGeo,
    new THREE.LineBasicMaterial({
      color, depthTest: false, depthWrite: false,
      transparent: true, opacity: 0.4,
    }),
  );
  ticks.renderOrder = GIZMO_RENDER_ORDER;
  ticks.userData['axisTickPart'] = true;
  visual.add(ticks);

  // Center hitbox (kept for easy picking on the whole resize handle)
  const hitGeo = new THREE.BoxGeometry(
    RESIZE_HITBOX_SIZE, RESIZE_HITBOX_SIZE, RESIZE_HITBOX_SIZE,
  );
  const hitbox = new THREE.Mesh(hitGeo, makeMaterial(0x000000, { visible: false }));
  applyRenderOrder(hitbox);

  return {
    visual,
    hitbox,
    cornerHitboxes: {
      normal: normalCornerHitboxes,
      mirror: mirrorCornerHitboxes,
    },
  };
}

// ---------------------------------------------------------------------------
// Endpoint shape handle (ADR-408 Φ-D) -- a single small camera-facing RING (torus)
// at a pipe end. Deliberately minimal (NOT the busy resize square/cross/brackets):
// a thin hollow ring reads as "drag this end" while its open centre keeps the pipe-
// end CAP visible (a solid disc/sphere hid it). The overlay billboards the ring to
// the camera each frame so it stays a full circle from any orbit angle. Returns
// {visual torus, larger invisible box hitbox}. Torus lies in its local XY plane
// (normal +Z) — the billboard aligns that normal with the view direction.
// ---------------------------------------------------------------------------

export function buildEndpointHandle(color: number): { visual: THREE.Mesh; hitbox: THREE.Mesh } {
  const visual = new THREE.Mesh(
    new THREE.TorusGeometry(ENDPOINT_RING_RADIUS, ENDPOINT_RING_TUBE, 10, 28),
    makeMaterial(color),
  );
  applyRenderOrder(visual);

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(ENDPOINT_HITBOX_SIZE, ENDPOINT_HITBOX_SIZE, ENDPOINT_HITBOX_SIZE),
    makeMaterial(0x000000, { visible: false }),
  );
  applyRenderOrder(hitbox);

  return { visual, hitbox };
}

// ---------------------------------------------------------------------------
// Center pyramid -- orange, per-face opacity for pseudo-lighting
// Tip points outward along [1,1,1]/sqrt(3) diagonal; base perpendicular.
// ---------------------------------------------------------------------------

export function buildCenterHandle(color: number): THREE.Group {
  const inv3 = 1 / Math.sqrt(3);
  const dvec = [inv3, inv3, inv3];

  // Perpendicular basis (p1, p2) to the [1,1,1] diagonal. The original
  // `[d1-d2, d2-d0, d0-d1]` shortcut is degenerate here: all components of `dvec`
  // are equal, so it yields [0,0,0] → divide-by-zero → NaN vertices for the whole
  // pyramid (THREE then warns "computeBoundingSphere(): radius is NaN" every frame
  // the gizmo renders). Build a robust unit perpendicular by crossing with a
  // non-parallel axis instead; p2 = dvec × p1 (already unit since both are unit ⊥).
  const p1v = new THREE.Vector3(dvec[0], dvec[1], dvec[2])
    .cross(new THREE.Vector3(1, 0, 0))
    .normalize();
  const p1 = [p1v.x, p1v.y, p1v.z];
  const p2 = [
    dvec[1] * p1[2] - dvec[2] * p1[1],
    dvec[2] * p1[0] - dvec[0] * p1[2],
    dvec[0] * p1[1] - dvec[1] * p1[0],
  ];

  const tip = dvec.map((v) => v * PYRAMID_TIP_LEN);
  const bc = dvec.map((v) => v * -PYRAMID_BASE_OFF);
  const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
  const bv = angles.map((a) => [
    bc[0] + p1[0] * PYRAMID_BASE_R * Math.cos(a) + p2[0] * PYRAMID_BASE_R * Math.sin(a),
    bc[1] + p1[1] * PYRAMID_BASE_R * Math.cos(a) + p2[1] * PYRAMID_BASE_R * Math.sin(a),
    bc[2] + p1[2] * PYRAMID_BASE_R * Math.cos(a) + p2[2] * PYRAMID_BASE_R * Math.sin(a),
  ]);

  const group = new THREE.Group();

  const faces: [number[], number[], number[], number][] = [
    [tip, bv[0], bv[1], PYRAMID_FACE_OPACITIES[0]],
    [tip, bv[1], bv[2], PYRAMID_FACE_OPACITIES[1]],
    [tip, bv[2], bv[0], PYRAMID_FACE_OPACITIES[2]],
    [bv[0], bv[2], bv[1], PYRAMID_FACE_OPACITIES[3]],
  ];

  for (const [a, b, c, opa] of faces) {
    const verts = new Float32Array([...a, ...b, ...c]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex([0, 1, 2]);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      makeMaterial(color, { transparent: true, opacity: opa, side: THREE.DoubleSide }),
    );
    applyRenderOrder(mesh);
    group.add(mesh);
  }

  const edgePts = new Float32Array([
    ...tip, ...bv[0], ...tip, ...bv[1], ...tip, ...bv[2],
    ...bv[0], ...bv[1], ...bv[1], ...bv[2], ...bv[2], ...bv[0],
  ]);
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePts, 3));
  const edges = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({
      color, depthTest: false, depthWrite: false, transparent: true, opacity: 0.6,
    }),
  );
  edges.renderOrder = GIZMO_RENDER_ORDER;
  group.add(edges);

  return group;
}
