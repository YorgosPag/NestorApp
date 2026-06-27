/**
 * dxf-text-3d.ts — build a flat, textured-plane 3D representation of a raw DXF text entity
 * (ADR-537 β). DXF text has no stroke geometry, so `DxfToThreeConverter` used to skip it and
 * the entity was invisible / unpickable in 3D. This lays the text on the floor plane (Y=0) as
 * a `CanvasTexture` on a `PlaneGeometry`, in NATIVE DXF units — the converter's group-level
 * `sceneUnitsToMeters` scale converts it to the metre world like the rest of the wireframe.
 *
 * Font / height / width resolution reuse the 2D text SSoT (`text-rendering-config.ts`:
 * `getTextHeightWithFallback`, `estimateTextWidth`, `TEXT_FONTS`) so a glyph's footprint in 3D
 * matches the 2D plan — no duplicate text-metrics logic.
 *
 * v1 scope: horizontal text (rotation ignored — most plan annotations are upright; rotated
 * text renders upright, a documented follow-up). The pick / hover-glow use the axis-aligned
 * `getEntityBBox` SSoT, so the generous click box stays consistent with this quad.
 */

import * as THREE from 'three';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import {
  getTextHeightWithFallback,
  estimateTextWidth,
  TEXT_FONTS,
} from '../../config/text-rendering-config';

/** Texture resolution: canvas pixels per drawing unit of text height (crisp at typical zoom). */
const TEXTURE_PX_PER_UNIT = 16;

/** Disposable bundle for one text mesh (the converter disposes these on re-sync / unmount). */
export interface DxfTextMeshBundle {
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.PlaneGeometry;
  readonly material: THREE.MeshBasicMaterial;
  readonly texture: THREE.CanvasTexture;
}

/** `0xRRGGBB` → `#rrggbb`. */
function intToHex(colorInt: number): string {
  return '#' + (colorInt & 0xffffff).toString(16).padStart(6, '0');
}

/**
 * Build a flat textured-plane mesh for a DXF text entity laid on the floor plane (Y=0) in
 * native DXF units, coloured `colorInt`. Returns null for empty text or when a 2D canvas is
 * unavailable. The plane spans the text's width × height anchored at `entity.position`
 * (baseline-left, matching the 2D anchor + the `getEntityBBox` lower-left corner).
 */
export function buildDxfTextMesh(entity: DxfText, colorInt: number): DxfTextMeshBundle | null {
  const text = entity.text ?? '';
  if (!text.trim()) return null;

  const heightUnits = getTextHeightWithFallback(undefined, entity.height);
  const widthUnits = Math.max(heightUnits, estimateTextWidth(text, heightUnits));

  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return null;

  canvas.width = Math.max(8, Math.round(widthUnits * TEXTURE_PX_PER_UNIT));
  canvas.height = Math.max(8, Math.round(heightUnits * TEXTURE_PX_PER_UNIT));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = intToHex(colorInt);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(heightUnits * TEXTURE_PX_PER_UNIT)}px ${TEXT_FONTS.DEFAULT_FAMILY}`;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter; // non power-of-two canvas → no mipmaps
  texture.magFilter = THREE.LinearFilter;

  const geometry = new THREE.PlaneGeometry(widthUnits, heightUnits);
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // rotateX(-90°) maps plane-local (x, y) → world (x, 0, -y) — EXACTLY the DXF→Three mapping
  // (`DxfToThreeConverter`), so the text lies flat, readable from above, aligned with the plan.
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(entity.position.x + widthUnits / 2, 0, -(entity.position.y + heightUnits / 2));

  return { mesh, geometry, material, texture };
}
