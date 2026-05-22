/**
 * ADR-366 Phase 9 / C.3.Q6 — Dim3DGripsRenderer.
 *
 * 3-grip pattern mirror ADR-362 (endpointA / endpointB / textAnchor). Each grip
 * is a billboard square sprite, color sourced from `CAD_UI_COLORS.grips`
 * tokens (cold / warm / hot states). Mirrors A.1.Q5 grip pattern (3D grips).
 *
 * Rendered as a Group containing 3 Sprites. Caller drags grips via raycaster
 * hit-test on each sprite (userData.dim3dGripId).
 */

import {
  CanvasTexture,
  Group,
  Sprite,
  SpriteMaterial,
} from 'three';
import { CAD_UI_COLORS } from '../../config/color-config';
import { buildDim3DLineLayout, DIM3D_DEFAULT_LAYOUT_OPTIONS } from './dim3d-line-geometry';
import type { BimDimension3D } from './dim3d-types';

export type Dim3DGripId = 'endpointA' | 'endpointB' | 'text';
export type Dim3DGripState = 'cold' | 'warm' | 'hot';

const GRIP_SIZE_WORLD = 0.06;

interface Dim3DGripsHandles {
  readonly root: Group;
  readonly grips: Record<Dim3DGripId, Sprite>;
  setGripState(id: Dim3DGripId, state: Dim3DGripState): void;
  update(dim: BimDimension3D): void;
  dispose(): void;
}

export function createDim3DGripsRenderer(dim: BimDimension3D): Dim3DGripsHandles {
  const root = new Group();
  root.name = `dim3d_grips_${dim.id}`;
  root.userData['dim3dId'] = dim.id;

  const grips: Record<Dim3DGripId, Sprite> = {
    endpointA: createGripSprite(dim.id, 'endpointA'),
    endpointB: createGripSprite(dim.id, 'endpointB'),
    text: createGripSprite(dim.id, 'text'),
  };
  root.add(grips.endpointA, grips.endpointB, grips.text);

  function update(next: BimDimension3D) {
    const layout = buildDim3DLineLayout(next.mode, next.placement, next.anchor, {
      ...DIM3D_DEFAULT_LAYOUT_OPTIONS,
      leaderShape: next.leaderStyle.shape,
    });
    grips.endpointA.position.set(next.anchor.endpointA.x, next.anchor.endpointA.y, next.anchor.endpointA.z);
    grips.endpointB.position.set(next.anchor.endpointB.x, next.anchor.endpointB.y, next.anchor.endpointB.z);
    grips.text.position.set(layout.textAnchor.x, layout.textAnchor.y, layout.textAnchor.z);
  }

  function setGripState(id: Dim3DGripId, state: Dim3DGripState) {
    const sprite = grips[id];
    const material = sprite.material as SpriteMaterial;
    material.map?.dispose();
    material.map = buildGripTexture(state);
    material.needsUpdate = true;
  }

  update(dim);

  return {
    root,
    grips,
    setGripState,
    update,
    dispose() {
      (Object.keys(grips) as Dim3DGripId[]).forEach((id) => {
        const mat = grips[id].material as SpriteMaterial;
        mat.map?.dispose();
        mat.dispose();
      });
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────────────────

function createGripSprite(dimId: string, gripId: Dim3DGripId): Sprite {
  const material = new SpriteMaterial({
    map: buildGripTexture('cold'),
    transparent: true,
    depthTest: false,
  });
  const sprite = new Sprite(material);
  sprite.scale.set(GRIP_SIZE_WORLD, GRIP_SIZE_WORLD, 1);
  sprite.userData['dim3dId'] = dimId;
  sprite.userData['dim3dGripId'] = gripId;
  return sprite;
}

const STATE_COLORS: Record<Dim3DGripState, string> = {
  cold: CAD_UI_COLORS.grips.cold,
  warm: CAD_UI_COLORS.grips.warm,
  hot: CAD_UI_COLORS.grips.hot,
};

function buildGripTexture(state: Dim3DGripState): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = STATE_COLORS[state];
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = CAD_UI_COLORS.grips.outline_color;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 30, 30);
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
