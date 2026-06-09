/**
 * ADR-366 Phase 9 / C.3 — Dimension3DRenderer.
 *
 * Constructs the Three.js scene-graph for a single 3D dimension:
 *  - Dim line: BufferGeometry + LineBasicMaterial (1.5px screen-space mirror)
 *  - Leader lines: same material, separate BufferGeometry
 *  - Text: CanvasTexture sprite (resolution-independent label)
 *  - Arrow heads: cone meshes (filled triangle 8px screen-space approx)
 *
 * Renderer is stateless beyond its owned `THREE.Group` — callers swap geometry
 * on store mutation; no hidden subscriptions. Mirror of 2D dim renderer pattern.
 *
 * Color tokens REUSE existing 2D SSoT (`UI_COLORS_BASE.MEASUREMENT_LINE` +
 * `DISTANCE_MEASUREMENT_TEXT`) per ADR-366 C.3.Q4.
 */

import {
  BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { UI_COLORS_BASE } from '../../config/color-config';
import {
  DIM3D_DEFAULT_LAYOUT_OPTIONS,
  buildDim3DLineLayout,
  type ArrowTransform,
  type LayoutOptions,
} from './dim3d-line-geometry';
import { resolveTextPlaneQuaternion } from './dim3d-text-plane-orienter';
import { formatDim3DValue } from './dim3d-value-computer';
import type { BimDimension3D, Vec3 } from './dim3d-types';

const LINE_COLOR = UI_COLORS_BASE.MEASUREMENT_LINE;
const TEXT_COLOR = UI_COLORS_BASE.DISTANCE_MEASUREMENT_TEXT;
/** Black halo around the label glyphs for legibility on any background (test). */
const TEXT_OUTLINE_COLOR = '#000000';
const TEXT_OUTLINE_WIDTH = 8;
/** Lines + arrows draw OVER the model (depthTest off); the label (999) sits above them. */
const DIM_LINE_RENDER_ORDER = 998;

interface Dim3DRendererHandles {
  readonly root: Group;
  readonly dimLine: Line;
  readonly leaderLine: Line;
  readonly textSprite: Sprite;
  readonly arrows: readonly Mesh[];
  dispose(): void;
  update(dim: BimDimension3D, cameraPosition?: Vec3): void;
}

export function createDimension3DRenderer(
  dim: BimDimension3D,
  layoutOverride?: Partial<LayoutOptions>,
): Dim3DRendererHandles {
  const root = new Group();
  root.name = `dim3d_${dim.id}`;
  root.userData['dim3dId'] = dim.id;

  // depthTest:false → dim + leader lines are NEVER occluded by walls (Revit annotation
  // overlay), mirroring the label; renderOrder keeps them just under the text.
  const dimMaterial = new LineBasicMaterial({ color: LINE_COLOR, depthTest: false, depthWrite: false });
  const leaderMaterial = new LineBasicMaterial({ color: LINE_COLOR, depthTest: false, depthWrite: false });

  const dimGeometry = new BufferGeometry();
  const leaderGeometry = new BufferGeometry();
  const dimLine = new Line(dimGeometry, dimMaterial);
  const leaderLine = new Line(leaderGeometry, leaderMaterial);
  dimLine.renderOrder = DIM_LINE_RENDER_ORDER;
  leaderLine.renderOrder = DIM_LINE_RENDER_ORDER;
  root.add(dimLine, leaderLine);

  const textSprite = createTextSprite(formatLabel(dim));
  root.add(textSprite);

  const arrows: Mesh[] = [];
  const arrowMaterial = new MeshBasicMaterial({ color: LINE_COLOR, depthTest: false, depthWrite: false });

  function syncArrows(transforms: readonly ArrowTransform[]) {
    while (arrows.length > transforms.length) {
      const m = arrows.pop();
      if (m) {
        root.remove(m);
        m.geometry.dispose();
      }
    }
    while (arrows.length < transforms.length) {
      const cone = new Mesh(new ConeGeometry(0.04, 0.12, 6), arrowMaterial);
      cone.renderOrder = DIM_LINE_RENDER_ORDER;
      arrows.push(cone);
      root.add(cone);
    }
    for (let i = 0; i < transforms.length; i++) {
      applyArrowTransform(arrows[i], transforms[i]);
    }
  }

  function update(next: BimDimension3D, cameraPosition?: Vec3) {
    const layout = buildDim3DLineLayout(next.mode, next.placement, next.anchor, {
      ...DIM3D_DEFAULT_LAYOUT_OPTIONS,
      leaderShape: next.leaderStyle.shape,
      ...layoutOverride,
    });
    writeLineGeometry(dimGeometry, layout.dimLine);
    writeLineGeometry(leaderGeometry, layout.leaderLines);

    textSprite.position.set(layout.textAnchor.x, layout.textAnchor.y, layout.textAnchor.z);
    const labelTexture = createLabelTexture(formatLabel(next));
    (textSprite.material as SpriteMaterial).map?.dispose();
    (textSprite.material as SpriteMaterial).map = labelTexture;
    (textSprite.material as SpriteMaterial).needsUpdate = true;

    const orientation = resolveTextPlaneQuaternion(
      next.textPlane,
      next.anchor,
      {
        cameraPosition,
        spritePosition: layout.textAnchor,
        planeNormal: { x: 0, y: 1, z: 0 },
      },
    );
    applyTextOrientation(textSprite, orientation, next.textPlane);

    syncArrows(layout.arrows);
  }

  update(dim);

  return {
    root,
    dimLine,
    leaderLine,
    textSprite,
    arrows,
    update,
    dispose() {
      dimGeometry.dispose();
      leaderGeometry.dispose();
      dimMaterial.dispose();
      leaderMaterial.dispose();
      arrowMaterial.dispose();
      arrows.forEach((a) => a.geometry.dispose());
      (textSprite.material as SpriteMaterial).map?.dispose();
      (textSprite.material as SpriteMaterial).dispose();
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────────────────

function writeLineGeometry(geometry: BufferGeometry, points: readonly Vec3[]) {
  const flat = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    flat[i * 3 + 0] = points[i].x;
    flat[i * 3 + 1] = points[i].y;
    flat[i * 3 + 2] = points[i].z;
  }
  geometry.setAttribute('position', new Float32BufferAttribute(flat, 3));
  geometry.computeBoundingSphere();
}

function applyArrowTransform(mesh: Mesh, transform: ArrowTransform) {
  mesh.position.set(transform.tip.x, transform.tip.y, transform.tip.z);
  const dir = new Vector3(transform.direction.x, transform.direction.y, transform.direction.z);
  if (dir.lengthSq() === 0) return;
  dir.normalize();
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
}

function formatLabel(dim: BimDimension3D): string {
  return formatDim3DValue(dim.value, dim.unit, dim.precision, dim.mode);
}

function createTextSprite(text: string): Sprite {
  const texture = createLabelTexture(text);
  // depthTest:false → the label is NEVER occluded by walls/geometry (Revit annotation
  // overlay); the high renderOrder keeps it above other transparents (e.g. the ghost).
  const material = new SpriteMaterial({ map: texture, transparent: true, opacity: 1, depthTest: false, depthWrite: false });
  const sprite = new Sprite(material);
  sprite.renderOrder = 999;
  sprite.scale.set(0.4, 0.12, 1);
  return sprite;
}

function createLabelTexture(text: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    // Black outline (halo) around the glyphs for legibility on any background.
    ctx.lineJoin = 'round';
    ctx.strokeStyle = TEXT_OUTLINE_COLOR;
    ctx.lineWidth = TEXT_OUTLINE_WIDTH;
    ctx.strokeText(text, cx, cy);
    ctx.fillStyle = TEXT_COLOR;
    // Overdraw so the anti-aliased glyph edges accumulate to full opacity (solid /
    // «συμπαγή» — no residual translucency on the thin non-bold strokes).
    ctx.fillText(text, cx, cy);
    ctx.fillText(text, cx, cy);
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function applyTextOrientation(
  sprite: Sprite,
  quat: Quaternion,
  mode: BimDimension3D['textPlane'],
): void {
  if (mode === 'world') {
    sprite.quaternion.copy(quat);
  }
  // Billboard mode: Three.js Sprite already auto-faces the camera — keep identity.
}
