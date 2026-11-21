/**
 * ViewCube overlay builders: compass direction, roll arrows, face nav arrows.
 * PORT_AS_IS from GenArc viewCubeOverlay.ts (ADR-366 §8.2 SPEC-3D-004A).
 */

import * as THREE from 'three';
import type { HitUserData } from './view-cube-mesh';

export function computeCompassDirection(
  cardinal: string, northAngleRad: number,
  camPosition: THREE.Vector3, target: THREE.Vector3,
): THREE.Vector3 {
  const camDir = camPosition.clone().sub(target).normalize();
  const elevation = Math.asin(Math.max(-1, Math.min(1, camDir.y)));
  const azMap: Record<string, number> = {
    N: northAngleRad, E: northAngleRad + Math.PI / 2,
    S: northAngleRad + Math.PI, W: northAngleRad - Math.PI / 2,
  };
  const az = azMap[cardinal] ?? 0;
  return new THREE.Vector3(
    Math.sin(az) * Math.cos(elevation), Math.sin(elevation),
    Math.cos(az) * Math.cos(elevation),
  );
}

/** Default (un-hovered) color of the face-nav arrows — reused as reset value. */
export const NAV_ARROW_COLOR = 0x7A8288;

const FACE_NAV_DEFS: ReadonlyArray<{
  pos: readonly [number, number, number];
  dir: readonly [number, number, number];
  navTarget: 'front' | 'back' | 'left' | 'right';
}> = [
  { pos: [0, 0, -0.90],  dir: [0, 0, 1],  navTarget: 'back'  },
  { pos: [0.90, 0, 0],   dir: [-1, 0, 0], navTarget: 'right' },
  { pos: [0, 0, 0.90],   dir: [0, 0, -1], navTarget: 'front' },
  { pos: [-0.90, 0, 0],  dir: [1, 0, 0],  navTarget: 'left'  },
];

const ROLL_ARROW_CANVAS_PX = 128;
const ROLL_ARROW_SPRITE_SCALE = 0.9;
/** Compass ring TorusGeometry radius (mirror of view-cube-mesh.ts). */
const COMPASS_RING_RADIUS = 1.50;
/** Roll arrows lie on a circle CONCENTRIC with the ring but larger, so each
 *  arrow is a true arc of that circle (centre = cube centre). Kept < the 1.95
 *  mini-frustum half-extent so the top of the circle stays visible. */
const CONCENTRIC_RADIUS = COMPASS_RING_RADIUS * 1.28;   // ≈ 1.92
/** Angular offset of each arrow from the top of the concentric circle. */
const ROLL_ARROW_PHI = 0.34;                            // rad ≈ 19.5°

/**
 * Draws ONE roll arrow as an arc of the concentric circle. `phi` = the arrow's
 * angular position from the top (signed). The arc centre is the cube centre
 * projected into this sprite's canvas, so the arc is genuinely concentric with
 * the ring (not a local bow). `cw` picks which terminus carries the arrowhead so
 * the two arrows point in opposite roll directions.
 */
function drawCurvedArrow(ctx: CanvasRenderingContext2D, cw: boolean, phi: number): void {
  const px = ROLL_ARROW_CANVAS_PX;
  const pxPerWorld = px / ROLL_ARROW_SPRITE_SCALE;
  const Rpx = CONCENTRIC_RADIUS * pxPerWorld;           // concentric radius in canvas px
  const cx = px / 2, cy = px / 2;
  // Cube centre projected into the canvas. Sprite world pos = (Rc·sinφ, Rc·cosφ);
  // the centre lies Rc away toward (-sinφ, +cosφ) in canvas (canvas y is flipped).
  const Cx = cx - Math.sin(phi) * Rpx;
  const Cy = cy + Math.cos(phi) * Rpx;
  const alpha = Math.atan2(cy - Cy, cx - Cx);          // sprite centre as seen from C
  const delta = 40 / Rpx;                              // half arc length (px → rad)
  // Drawn WHITE so the SpriteMaterial.color drives the visible tint (gray rest,
  // orange hover; a gray texture × orange would be muddy).
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(Cx, Cy, Rpx, alpha - delta, alpha + delta, false);
  ctx.stroke();
  // Arrowhead at one terminus, tangent to the circle.
  const aEnd = cw ? alpha - delta : alpha + delta;
  const dirSign = cw ? -1 : 1;
  const ex = Cx + Rpx * Math.cos(aEnd);
  const ey = Cy + Rpx * Math.sin(aEnd);
  const tx = -Math.sin(aEnd) * dirSign, ty = Math.cos(aEnd) * dirSign;
  const aLen = 20, aW = 13;
  const pxn = -ty, pyn = tx;
  ctx.beginPath();
  ctx.moveTo(ex + tx * aLen, ey + ty * aLen);          // tip
  ctx.lineTo(ex + pxn * aW, ey + pyn * aW);
  ctx.lineTo(ex - pxn * aW, ey - pyn * aW);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function createRollArrows(): { sprites: THREE.Sprite[]; hitMeshes: THREE.Mesh[] } {
  const sprites: THREE.Sprite[] = [];
  const hitMeshes: THREE.Mesh[] = [];
  const configs: Array<{ cw: boolean; phi: number; rollDir: 1 | -1 }> = [
    { cw: false, phi:  ROLL_ARROW_PHI, rollDir: -1 },   // right side
    { cw: true,  phi: -ROLL_ARROW_PHI, rollDir:  1 },   // left side
  ];
  for (const { cw, phi, rollDir } of configs) {
    const canvas = document.createElement('canvas');
    canvas.width = ROLL_ARROW_CANVAS_PX; canvas.height = ROLL_ARROW_CANVAS_PX;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, ROLL_ARROW_CANVAS_PX, ROLL_ARROW_CANVAS_PX);
    drawCurvedArrow(ctx, cw, phi);
    const tex = new THREE.CanvasTexture(canvas);
    // color = default gray tint; hover swaps it to orange (texture is white).
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, color: NAV_ARROW_COLOR });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(ROLL_ARROW_SPRITE_SCALE);
    // Sit the sprite ON the concentric circle near the top.
    sprite.position.set(CONCENTRIC_RADIUS * Math.sin(phi), CONCENTRIC_RADIUS * Math.cos(phi), 0);
    sprite.visible = false;
    sprites.push(sprite);
    const hitGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.copy(sprite.position);
    hitMesh.visible = false;
    const ud: HitUserData = { type: 'roll', faces: [], rollDir };
    hitMesh.userData = ud;
    hitMeshes.push(hitMesh);
  }
  return { sprites, hitMeshes };
}

const NAV_ARROW_W = 0.30;
const NAV_ARROW_H = 0.22;
const _up = new THREE.Vector3(0, 1, 0);

function makeNavArrowGeo(dir: readonly [number, number, number]): THREE.BufferGeometry {
  const tipDir = new THREE.Vector3(dir[0], dir[1], dir[2]);
  const cross = new THREE.Vector3().crossVectors(tipDir, _up).normalize();
  const tip = tipDir.clone().multiplyScalar(NAV_ARROW_H / 2);
  const base = tipDir.clone().multiplyScalar(-NAV_ARROW_H / 2);
  const bL = base.clone().addScaledVector(cross, -NAV_ARROW_W / 2);
  const bR = base.clone().addScaledVector(cross, NAV_ARROW_W / 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    tip.x, tip.y, tip.z, bL.x, bL.y, bL.z, bR.x, bR.y, bR.z,
  ], 3));
  return geo;
}

export function createFaceNavArrows(): {
  group: THREE.Group;
  hitMeshes: THREE.Mesh[];
  materials: THREE.MeshBasicMaterial[];
} {
  const group = new THREE.Group();
  const hitMeshes: THREE.Mesh[] = [];
  const materials: THREE.MeshBasicMaterial[] = [];
  for (const { pos, dir, navTarget } of FACE_NAV_DEFS) {
    const geo = makeNavArrowGeo(dir);
    const mat = new THREE.MeshBasicMaterial({
      color: NAV_ARROW_COLOR, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthTest: false,
    });
    materials.push(mat);
    const arrow = new THREE.Mesh(geo, mat);
    arrow.position.set(pos[0], pos[1], pos[2]);
    arrow.renderOrder = 10;
    arrow.visible = false;
    group.add(arrow);
    const hitGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.set(pos[0], pos[1], pos[2]);
    hitMesh.visible = false;
    const ud: HitUserData = { type: 'faceNav', faces: [], navTarget };
    hitMesh.userData = ud;
    hitMeshes.push(hitMesh);
    group.add(hitMesh);
  }
  return { group, hitMeshes, materials };
}
