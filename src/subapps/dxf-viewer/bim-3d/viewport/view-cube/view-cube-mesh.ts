/**
 * ViewCube mesh builders: visual cube, hit targets, compass ring, home button.
 * PORT_AS_IS from GenArc viewCubeMesh.ts (ADR-366 §8.2 SPEC-3D-004A).
 */

import * as THREE from 'three';
import { drawZoneHighlight, type FaceZone } from './view-cube-highlight';
// 🏢 Color-Conversion SSoT (ADR-573): int(0xRRGGBB)→hex via canonical `dxf-true-color`.
import { trueColorToHex } from '../../../utils/dxf-true-color';

export const FACE_DIRS: readonly THREE.Vector3[] = [
  new THREE.Vector3( 1,  0,  0),
  new THREE.Vector3(-1,  0,  0),
  new THREE.Vector3( 0,  1,  0),
  new THREE.Vector3( 0, -1,  0),
  new THREE.Vector3( 0,  0,  1),
  new THREE.Vector3( 0,  0, -1),
] as const;

export type HitType = 'face' | 'edge' | 'corner' | 'compass' | 'home' | 'roll' | 'faceNav';

export interface HitUserData {
  readonly type: HitType;
  readonly faces: readonly number[];
  readonly cardinal?: 'N' | 'E' | 'S' | 'W';
  readonly rollDir?: 1 | -1;
  readonly navTarget?: 'front' | 'back' | 'left' | 'right';
}

/**
 * SSoT dark color for ALL ViewCube button/face outlines — the per-face frame
 * stroke (every face, light or dark) AND the 3D cube edge lines. Single source:
 * the hex number; the CSS string is derived from it so both renderers (canvas
 * 2D stroke + THREE LineBasicMaterial) stay in sync from one value.
 */
const VIEWCUBE_OUTLINE_COLOR_HEX = 0x1a1a1a;
const VIEWCUBE_OUTLINE_COLOR_CSS = trueColorToHex(VIEWCUBE_OUTLINE_COLOR_HEX);
/** Width (px, texture space) of the per-face 3×3 button-zone grid lines. */
const OUTLINE_LINE_WIDTH = 3;

const LABEL_DARK_BG  = '#3c3c3c';
const LABEL_TOP_BG   = '#e8e8e8';
const LABEL_WHITE    = '#ffffff';
const LABEL_DARK_TXT = '#222222';
const LABEL_FONT     = 'bold 22px "IBM Plex Sans", sans-serif';

export const FACE_TEX_SIZE = 128;
export const FACE_TEX_BORDER = 22;

function drawBaseFace(ctx: CanvasRenderingContext2D, label: string, isTop: boolean): void {
  const size = FACE_TEX_SIZE;
  const border = FACE_TEX_BORDER;
  ctx.fillStyle = isTop ? '#c8c8c8' : '#555555';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = isTop ? '#b0b0b0' : '#666666';
  ctx.fillRect(0, 0, border, border);
  ctx.fillRect(size - border, 0, border, border);
  ctx.fillRect(0, size - border, border, border);
  ctx.fillRect(size - border, size - border, border, border);
  ctx.fillStyle = isTop ? LABEL_TOP_BG : LABEL_DARK_BG;
  ctx.fillRect(border, border, size - 2 * border, size - 2 * border);
  // 3×3 zone grid → outlines the clickable "buttons" of this face: the centre
  // (face), the 4 edge strips and the 4 corner squares. Internal dividers ONLY
  // (no outer perimeter) so the cube itself shows no silhouette outline. SSoT color.
  ctx.strokeStyle = VIEWCUBE_OUTLINE_COLOR_CSS;
  ctx.lineWidth = OUTLINE_LINE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(border, 0); ctx.lineTo(border, size);
  ctx.moveTo(size - border, 0); ctx.lineTo(size - border, size);
  ctx.moveTo(0, border); ctx.lineTo(size, border);
  ctx.moveTo(0, size - border); ctx.lineTo(size, size - border);
  ctx.stroke();
  ctx.fillStyle = isTop ? LABEL_DARK_TXT : LABEL_WHITE;
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, size / 2, size / 2);
}

export interface FaceLabels {
  readonly right: string;
  readonly left: string;
  readonly top: string;
  readonly bottom: string;
  readonly front: string;
  readonly back: string;
}

export function createVisualCube(labels: FaceLabels): {
  mesh: THREE.Mesh;
  materials: THREE.MeshBasicMaterial[];
  setHighlights: (highlights: ReadonlyMap<number, FaceZone> | null) => void;
} {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const labelArr = [labels.right, labels.left, labels.top, labels.bottom, labels.front, labels.back];
  const topIndex = 2;
  const canvases: HTMLCanvasElement[] = [];
  const textures: THREE.CanvasTexture[] = [];
  let prevFaces = new Set<number>();
  const materials = labelArr.map((label, i) => {
    const canvas = document.createElement('canvas');
    canvas.width = FACE_TEX_SIZE; canvas.height = FACE_TEX_SIZE;
    drawBaseFace(canvas.getContext('2d')!, label, i === topIndex);
    const texture = new THREE.CanvasTexture(canvas);
    canvases.push(canvas); textures.push(texture);
    // Unlit: the highlight/label colors must render at their true value,
    // independent of scene lighting (Phong dimmed orange highlights to a muddy
    // tone on faces angled away from the directional light). Matches Autodesk
    // ViewCube's flat-shaded faces.
    return new THREE.MeshBasicMaterial({ map: texture });
  });
  function setHighlights(highlights: ReadonlyMap<number, FaceZone> | null): void {
    const newFaces = highlights ? new Set(highlights.keys()) : new Set<number>();
    const toRedraw = new Set([...prevFaces, ...newFaces]);
    for (const fi of toRedraw) {
      const cv = canvases[fi]; const tex = textures[fi];
      if (!cv || !tex) continue;
      const ctx = cv.getContext('2d')!;
      drawBaseFace(ctx, labelArr[fi]!, fi === topIndex);
      const zone = highlights?.get(fi);
      if (zone) drawZoneHighlight(ctx, zone, FACE_TEX_SIZE, FACE_TEX_BORDER);
      tex.needsUpdate = true;
    }
    prevFaces = newFaces;
  }
  return { mesh: new THREE.Mesh(geo, materials), materials, setHighlights };
}

export function createHitTargets(): THREE.Mesh[] {
  // DoubleSide so face hit planes work regardless of normal orientation (the
  // -Z face plane keeps the PlaneGeometry default +Z normal — without DoubleSide
  // it would never be raycast-hittable from -Z direction).
  const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const targets: THREE.Mesh[] = [];
  const faceDirs: Array<[number, number, number, number]> = [
    [ 1,  0,  0, 0], [-1,  0,  0, 1],
    [ 0,  1,  0, 2], [ 0, -1,  0, 3],
    [ 0,  0,  1, 4], [ 0,  0, -1, 5],
  ];
  for (const [nx, ny, nz, faceIdx] of faceDirs) {
    const geo = new THREE.PlaneGeometry(0.92, 0.92);
    const mesh = new THREE.Mesh(geo, hitMat);
    mesh.position.set(nx * 0.51, ny * 0.51, nz * 0.51);
    if (Math.abs(nx) > 0.5) mesh.rotation.y = nx > 0 ? Math.PI / 2 : -Math.PI / 2;
    else if (Math.abs(ny) > 0.5) mesh.rotation.x = ny > 0 ? -Math.PI / 2 : Math.PI / 2;
    const ud: HitUserData = { type: 'face', faces: [faceIdx] };
    mesh.userData = ud;
    targets.push(mesh);
  }
  const edges: Array<[number, number]> = [
    [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 2], [1, 3], [1, 4], [1, 5],
    [2, 4], [2, 5], [3, 4], [3, 5],
  ];
  for (const [a, b] of edges) {
    const da = FACE_DIRS[a]!;
    const db = FACE_DIRS[b]!;
    const pos = new THREE.Vector3().addVectors(da, db).multiplyScalar(0.5);
    // Edge axis = the axis NEITHER face contributes to (sum of |da|+|db| = 0).
    // Face axes (sum = 1) get the thin 0.24 extent so the box sits as a slim bar
    // along the edge instead of a 0.92³ cube that occludes the face hit plane.
    // Original `> 1.5` threshold never triggered (max sum for adjacent faces = 1),
    // so every edge became a full-volume cube covering ~94% of each face area.
    const geo = new THREE.BoxGeometry(
      Math.abs(da.x) + Math.abs(db.x) > 0.5 ? 0.24 : 0.92,
      Math.abs(da.y) + Math.abs(db.y) > 0.5 ? 0.24 : 0.92,
      Math.abs(da.z) + Math.abs(db.z) > 0.5 ? 0.24 : 0.92,
    );
    const mesh = new THREE.Mesh(geo, hitMat);
    mesh.position.copy(pos);
    const ud: HitUserData = { type: 'edge', faces: [a, b] };
    mesh.userData = ud;
    targets.push(mesh);
  }
  const corners: Array<[number, number, number]> = [
    [ 1,  1,  1], [ 1,  1, -1], [ 1, -1,  1], [ 1, -1, -1],
    [-1,  1,  1], [-1,  1, -1], [-1, -1,  1], [-1, -1, -1],
  ];
  for (const [cx, cy, cz] of corners) {
    const faceIdxs = [cx > 0 ? 0 : 1, cy > 0 ? 2 : 3, cz > 0 ? 4 : 5];
    const geo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
    const mesh = new THREE.Mesh(geo, hitMat);
    mesh.position.set(cx * 0.5, cy * 0.5, cz * 0.5);
    const ud: HitUserData = { type: 'corner', faces: faceIdxs };
    mesh.userData = ud;
    targets.push(mesh);
  }
  return targets;
}

export interface CompassLabels {
  readonly n: string;
  readonly e: string;
  readonly s: string;
  readonly w: string;
}

/** Default (un-hovered) color of the compass ring torus — reused as reset value. */
export const COMPASS_RING_DEFAULT_COLOR = 0x8899aa;

export function createCompassRing(labels: CompassLabels): {
  group: THREE.Group;
  hitMeshes: THREE.Mesh[];
  ringMaterial: THREE.MeshBasicMaterial;
  /** The torus mesh itself — pickable so hovering the ring body (not just the
   *  N/E/S/W letters) tints it. userData type 'compass' with no cardinal. */
  ringMesh: THREE.Mesh;
  /** Cardinal label sprite materials, parallel to hitMeshes — tinted on hover. */
  labelMaterials: THREE.SpriteMaterial[];
} {
  const group = new THREE.Group();
  const hitMeshes: THREE.Mesh[] = [];
  const labelMaterials: THREE.SpriteMaterial[] = [];
  const ringGeo = new THREE.TorusGeometry(1.50, 0.16, 16, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: COMPASS_RING_DEFAULT_COLOR, opacity: 0.8, transparent: true });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  // Hover-only: no cardinal → handleClick's `ud.cardinal` guard makes a click inert.
  const ringUd: HitUserData = { type: 'compass', faces: [] };
  ring.userData = ringUd;
  group.add(ring);
  const cardinals: Array<{ label: string; cardinal: 'N' | 'E' | 'S' | 'W'; x: number; z: number }> = [
    { label: labels.n, cardinal: 'N', x:  0,    z: -1.72 },
    { label: labels.e, cardinal: 'E', x:  1.72, z:  0    },
    { label: labels.s, cardinal: 'S', x:  0,    z:  1.72 },
    { label: labels.w, cardinal: 'W', x: -1.72, z:  0    },
  ];
  for (const { label, cardinal, x, z } of cardinals) {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 32, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    labelMaterials.push(spriteMat);
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.setScalar(0.6);
    sprite.position.set(x, 0, z);
    group.add(sprite);
    const hitGeo = new THREE.PlaneGeometry(0.5, 0.5);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.set(x, 0, z);
    hitMesh.rotation.x = -Math.PI / 2;
    const ud: HitUserData = { type: 'compass', faces: [], cardinal };
    hitMesh.userData = ud;
    hitMeshes.push(hitMesh);
    group.add(hitMesh);
  }
  return { group, hitMeshes, ringMaterial: ringMat, ringMesh: ring, labelMaterials };
}

export function createHomeButton(): { sprite: THREE.Sprite; hitMesh: THREE.Mesh } {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = '#aaaaaa';
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#333333';
  ctx.beginPath();
  ctx.moveTo(32, 14); ctx.lineTo(50, 30); ctx.lineTo(14, 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(18, 30, 28, 18);
  ctx.fillStyle = '#aaaaaa';
  ctx.fillRect(27, 34, 10, 14);
  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.setScalar(0.4);
  sprite.position.set(-1.4, 1.5, 0);
  const hitGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.position.copy(sprite.position);
  const ud: HitUserData = { type: 'home', faces: [] };
  hitMesh.userData = ud;
  return { sprite, hitMesh };
}
