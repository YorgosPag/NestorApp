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
  TEXT_FONTS,
} from '../../config/text-rendering-config';
// ADR-557 Φ-attachment — the attachment-aware text-box SSoT the 2D grips + hover frame
// also consume, so the 3D plane sits on the SAME box centre (2D ≡ 3D parity).
import { resolveTextBox } from '../../bim/text/text-box';

/** Texture resolution: canvas pixels per drawing unit of text height (crisp at typical zoom). */
const TEXTURE_PX_PER_UNIT = 16;

/**
 * ADR-366 §B.5 — hard cap on the CanvasTexture's largest dimension. A tall DXF annotation
 * (e.g. a 300-unit title at 16 px/unit) produced an ~18760×6000 canvas → a ~340 MB RGBA GPU
 * upload that Three.js then clamps to maxTextureSize — a catastrophic per-texture stall on a
 * weak/integrated GPU (browser-verified: a single such upload spiked the click handler to
 * 616 ms and starved the cursor). The cap scales `pxPerUnit` down UNIFORMLY so the texture
 * fits; because the plane's world size is derived from `canvas / pxPerUnit`, the text keeps
 * the EXACT same physical footprint — only its texel resolution drops (a label never needs
 * thousands of px). 2048 is plenty crisp for an underlay annotation.
 */
const MAX_TEXTURE_DIM = 2048;

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

  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return null;

  // Font px = text height × texture resolution. Pad so glyph side-bearings / anti-aliasing never
  // touch the canvas edge (Greek caps like Π are wider than a 0.6×height estimate → clipped).
  // `measureCanvas` returns the canvas px footprint for a given px/unit resolution.
  const measureCanvas = (pxPerUnit: number) => {
    const fontPx = Math.max(1, Math.round(heightUnits * pxPerUnit));
    const padPx = Math.ceil(fontPx * 0.25);
    ctx.font = `${fontPx}px ${TEXT_FONTS.DEFAULT_FAMILY}`;
    const textPx = Math.ceil(ctx.measureText(text).width);
    return { fontPx, padPx, width: Math.max(8, textPx + padPx * 2), height: Math.max(8, fontPx + padPx * 2) };
  };

  // ADR-366 §B.5 — measure at full resolution, then if the canvas would exceed MAX_TEXTURE_DIM
  // scale px/unit down uniformly so the GPU upload stays bounded. The plane world size below is
  // derived from `canvas / pxPerUnit`, so it is INVARIANT under this scale — only texel density drops.
  let pxPerUnit = TEXTURE_PX_PER_UNIT;
  let m = measureCanvas(pxPerUnit);
  const maxDim = Math.max(m.width, m.height);
  if (maxDim > MAX_TEXTURE_DIM) {
    pxPerUnit *= MAX_TEXTURE_DIM / maxDim;
    m = measureCanvas(pxPerUnit);
  }
  const font = `${m.fontPx}px ${TEXT_FONTS.DEFAULT_FAMILY}`;

  canvas.width = m.width;
  canvas.height = m.height;
  // Resizing the canvas resets the 2D context → re-apply all draw state before filling.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = intToHex(colorInt);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter; // non power-of-two canvas → no mipmaps
  texture.magFilter = THREE.LinearFilter;

  // Plane spans the canvas in world units (same px→unit factor) so the texture never distorts
  // and never clips. Centred on the attachment-aware box centre (below) — the padded plane
  // extends symmetrically around it (transparent margin), matching the 2D glyph block.
  const widthUnits = canvas.width / pxPerUnit;
  const heightUnitsPadded = canvas.height / pxPerUnit;
  const geometry = new THREE.PlaneGeometry(widthUnits, heightUnitsPadded);
  // ADR-537 underlay-depth — text is part of the DXF underlay and is drawn by the dedicated
  // overlay pass (`post-fx-overlay-pass.ts`) AFTER the lit scene + SSAO, so it needs NO `depthTest:false`
  // band-aid: depth-TESTED (walls in front occlude it, unified with the wireframe) but
  // `depthWrite:false` so the translucent quad never self-z-fights the linework it labels.
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // rotateX(-90°) maps plane-local (x, y) → world (x, 0, -y) — EXACTLY the DXF→Three mapping
  // (`DxfToThreeConverter`), so the text lies flat, readable from above, aligned with the plan.
  mesh.rotation.x = -Math.PI / 2;
  // ADR-557 Φ-attachment — anchor the plane CENTRE at the attachment-aware text-box centre
  // SSoT (`resolveTextBox`), the SAME box the 2D grips + hover frame use, so the 3D glyph
  // block coincides with them and 2D ≡ 3D (was: lower-left at position → ignored attachment).
  const boxCenter = resolveTextBox(entity).center;
  mesh.position.set(boxCenter.x, 0, -boxCenter.y);

  return { mesh, geometry, material, texture };
}
