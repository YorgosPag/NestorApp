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

const NAV_ARROW_COLOR = 0x7A8288;

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

function drawCurvedArrow(ctx: CanvasRenderingContext2D, cw: boolean): void {
  const S = 128 / 100;
  ctx.save();
  if (cw) { ctx.translate(128, 0); ctx.scale(-1, 1); }
  const cx = 50 * S, cy = 50 * S, r = 30 * S;
  ctx.strokeStyle = '#7A8288';
  ctx.lineWidth = 8 * S; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 3 * Math.PI / 2, false);
  ctx.stroke();
  ctx.fillStyle = '#7A8288';
  ctx.beginPath();
  ctx.moveTo(12 * S, 48 * S);
  ctx.lineTo(20 * S, 62 * S);
  ctx.lineTo(28 * S, 48 * S);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function createRollArrows(): { sprites: THREE.Sprite[]; hitMeshes: THREE.Mesh[] } {
  const sprites: THREE.Sprite[] = [];
  const hitMeshes: THREE.Mesh[] = [];
  const configs: Array<{ cw: boolean; x: number; rollDir: 1 | -1 }> = [
    { cw: false, x: -0.70, rollDir: -1 },
    { cw: true,  x:  0.70, rollDir:  1 },
  ];
  for (const { cw, x, rollDir } of configs) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);
    drawCurvedArrow(ctx, cw);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(0.65);
    sprite.position.set(x, 1.70, 0);
    sprite.visible = false;
    sprites.push(sprite);
    const hitGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
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
