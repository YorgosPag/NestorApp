/**
 * glyph-atlas-text-mesh.ts — merged, atlas-sampled text mesh builder for 3D DXF text (ADR-645 Φάση B).
 *
 * Accumulates every text entity's glyph quads (from `layoutTextGlyphs`) into ONE growing
 * BufferGeometry that samples the shared `GlyphAtlas`: position (floor plane), UV (atlas cell) and
 * a per-vertex colour (entity tint). Rendered as ONE `THREE.Mesh` → ONE draw call for the whole
 * floor's text, replacing the old thousands-of-`CanvasTexture` meshes.
 *
 * Streaming (ADR-645 Φάση A): buffers are pre-sized to a glyph upper bound; `addEntity` writes a
 * batch and `flush` bumps only the written range + `setDrawRange`, so the mesh «fills in» frame by
 * frame on the `UnifiedFrameScheduler` without a re-upload of the whole buffer.
 *
 * Selectable/hoverable is UNAFFECTED: 3D DXF text pick + hover glow are entity-driven (plan-space
 * proximity `dxf-wireframe-hit-test` + em-box outline `dxf-entity-outline`), never a raycast of the
 * text mesh — so collapsing the per-text meshes into one merged mesh keeps them fully interactive.
 */

import * as THREE from 'three';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import { resolveTextFont } from './dxf-text-font-resolution';
import { layoutTextGlyphs, type GlyphQuad } from './glyph-atlas-text-layout';
import { GlyphAtlas } from './glyph-atlas';

/** ADR-537 underlay-depth — same material contract the old text plane + the wireframe use. */
const TEXT_OPACITY = 1;
/** Scratch colour (module-level: no per-glyph alloc). setHex converts sRGB→linear like line colours. */
const _col = new THREE.Color();
/** Scratch point for the incremental bounding box (module-level: no per-corner alloc). */
const _p = new THREE.Vector3();

/** Upper bound of glyph quads a set of text entities can emit (code points, whitespace included). */
export function countTextGlyphCapacity(entities: readonly DxfText[]): number {
  let n = 0;
  for (const e of entities) n += e.text ? Array.from(e.text).length : 0;
  return n;
}

/**
 * A growing, atlas-sampled text mesh for ONE floor group. Pre-allocates buffers for `capacity`
 * glyphs and appends entity batches; `flush` publishes the written range. All glyph coords are in
 * NATIVE DXF units (x, 0, −y) — the owning floor group's scale + elevation maps them to metres.
 */
export class AtlasTextMeshBuilder {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly positions: Float32Array;
  private readonly uvs: Float32Array;
  private readonly colors: Float32Array;
  private readonly capacity: number;
  private glyphCount = 0;
  /**
   * Running bounds over the WRITTEN glyphs only — assigned to `geometry.boundingBox` so
   * `Box3.setFromObject` (used by `getBounds` → camera framing) reads the real text extent, NOT the
   * pre-allocated (0,0,0) tail (`setFromObject` recomputes from the FULL array, ignoring drawRange).
   * Empty while `glyphCount===0` → contributes nothing to the union (frame on the wireframe, ADR-645 Φ.A).
   */
  private readonly bbox = new THREE.Box3();
  private readonly sphere = new THREE.Sphere();

  constructor(atlas: GlyphAtlas, capacity: number) {
    this.capacity = Math.max(0, capacity);
    this.positions = new Float32Array(this.capacity * 4 * 3);
    this.uvs = new Float32Array(this.capacity * 4 * 2);
    this.colors = new Float32Array(this.capacity * 4 * 3);
    const indices = new Uint32Array(this.capacity * 6);
    for (let k = 0; k < this.capacity; k++) {
      const b = k * 4;
      const o = k * 6;
      indices[o] = b; indices[o + 1] = b + 1; indices[o + 2] = b + 2;
      indices[o + 3] = b; indices[o + 4] = b + 2; indices[o + 5] = b + 3;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.geometry.setDrawRange(0, 0);
    // Non-null (empty) bounds → `setFromObject` skips the full-array recompute + unions nothing yet.
    this.geometry.boundingBox = this.bbox;
    this.geometry.boundingSphere = this.sphere;
    // ADR-537 underlay-depth — drawn by the dedicated post-FX overlay pass: depth-TESTED (walls
    // occlude), depthWrite:false (no self-z-fight with the linework it labels). Alpha = atlas
    // coverage; vertexColors tint per entity; map = the shared atlas.
    this.material = new THREE.MeshBasicMaterial({
      map: atlas.texture, vertexColors: true, transparent: true, opacity: TEXT_OPACITY,
      depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'dxf-text-atlas';
    this.mesh.frustumCulled = false; // bounds fill in progressively; the underlay pass draws it whole
  }

  /** Lay out + append one text entity's glyphs (tinted `colorInt`). No-op past capacity. */
  addEntity(entity: DxfText, atlas: GlyphAtlas, colorInt: number): void {
    const font = resolveTextFont(entity);
    const quads = layoutTextGlyphs(entity, font, {
      fontMetrics: atlas.getFontMetrics(font),
      getCell: (ch) => atlas.getCell(font, ch),
    });
    if (quads.length === 0) return;
    _col.setHex(colorInt);
    for (const q of quads) {
      if (this.glyphCount >= this.capacity || !isFiniteQuad(q)) continue;
      this.writeQuad(q, _col.r, _col.g, _col.b);
    }
  }

  private writeQuad(q: GlyphQuad, r: number, g: number, b: number): void {
    const v = this.glyphCount * 4;
    const p = v * 3;
    const u = v * 2;
    // Plan (x, y) → floor plane (x, 0, −y); corner order TL, TR, BR, BL.
    this.positions.set([q.x0, 0, -q.y0, q.x1, 0, -q.y1, q.x2, 0, -q.y2, q.x3, 0, -q.y3], p);
    this.uvs.set([q.u0, q.v0, q.u1, q.v0, q.u1, q.v1, q.u0, q.v1], u);
    this.colors.set([r, g, b, r, g, b, r, g, b, r, g, b], p);
    // Grow the written-only bounds (O(1) per corner — never a full-array rescan).
    this.bbox.expandByPoint(_p.set(q.x0, 0, -q.y0));
    this.bbox.expandByPoint(_p.set(q.x1, 0, -q.y1));
    this.bbox.expandByPoint(_p.set(q.x2, 0, -q.y2));
    this.bbox.expandByPoint(_p.set(q.x3, 0, -q.y3));
    this.glyphCount++;
  }

  /** Publish the written range for this frame (streamed fill-in) + refresh the bounding sphere. */
  flush(): void {
    if (this.glyphCount === 0) return;
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('uv') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    this.geometry.setDrawRange(0, this.glyphCount * 6);
    this.bbox.getBoundingSphere(this.sphere);
  }

  /** True while no glyph has been written (caller can skip adding an empty mesh to the scene). */
  get isEmpty(): boolean {
    return this.glyphCount === 0;
  }

  dispose(): void {
    // NOTE: the atlas TEXTURE is converter-owned + shared across floors → NOT disposed here.
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** All four corners finite — one NaN would poison the shared overlay Box3 → NaN-frame the camera. */
function isFiniteQuad(q: GlyphQuad): boolean {
  return Number.isFinite(q.x0) && Number.isFinite(q.y0) && Number.isFinite(q.x1) && Number.isFinite(q.y1)
    && Number.isFinite(q.x2) && Number.isFinite(q.y2) && Number.isFinite(q.x3) && Number.isFinite(q.y3);
}
