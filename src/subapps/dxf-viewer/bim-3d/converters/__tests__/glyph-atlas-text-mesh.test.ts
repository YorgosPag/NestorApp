/**
 * glyph-atlas-text-mesh.test.ts — ADR-645 Φάση B.
 *
 * The merged atlas text mesh builder: capacity counting, streamed draw-range growth, per-entity
 * vertex-colour tint, capacity cap, and the NaN guard (a bad anchor must not poison the Box3).
 * Uses a real `GlyphAtlas` + a deterministic stub font so the glyph count is predictable.
 */

import * as THREE from 'three';
import { AtlasTextMeshBuilder, countTextGlyphCapacity } from '../glyph-atlas-text-mesh';
import { GlyphAtlas } from '../glyph-atlas';
import { installStubFont } from '../../../text-engine/fonts/__tests__/_stub-font';
import type { DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';

function text(overrides: Partial<DxfText>): DxfText {
  return {
    id: 't', type: 'text', text: 'AB', height: 10, position: { x: 0, y: 0 }, visible: true,
    textStyle: { fontFamily: 'arial' }, ...overrides,
  } as DxfText;
}

const drawCount = (b: AtlasTextMeshBuilder): number => (b.mesh.geometry as THREE.BufferGeometry).drawRange.count;

describe('countTextGlyphCapacity', () => {
  it('sums code-point counts (whitespace + newlines included as an upper bound)', () => {
    expect(countTextGlyphCapacity([text({ text: 'AB' }), text({ text: 'C D' })])).toBe(2 + 3);
    expect(countTextGlyphCapacity([text({ text: '' })])).toBe(0);
  });
});

describe('AtlasTextMeshBuilder', () => {
  let cleanup: () => void;
  beforeAll(() => { cleanup = installStubFont(0.6, 'arial'); });
  afterAll(() => cleanup());

  it('writes one quad (6 indices) per ink glyph and grows the draw range on flush', () => {
    const atlas = new GlyphAtlas();
    const b = new AtlasTextMeshBuilder(atlas, countTextGlyphCapacity([text({ text: 'AB' })]));
    expect(b.isEmpty).toBe(true);
    expect(drawCount(b)).toBe(0);
    b.addEntity(text({ text: 'AB' }), atlas, 0xffffff);
    expect(b.isEmpty).toBe(false);
    expect(drawCount(b)).toBe(0); // not published until flush
    b.flush();
    expect(drawCount(b)).toBe(2 * 6); // 2 glyphs × 6 indices
    b.dispose();
    atlas.dispose();
  });

  it('tints every vertex with the (sRGB→linear) entity colour', () => {
    const atlas = new GlyphAtlas();
    const b = new AtlasTextMeshBuilder(atlas, 2);
    b.addEntity(text({ text: 'A' }), atlas, 0xffffff); // white → linear (1,1,1)
    const color = (b.mesh.geometry as THREE.BufferGeometry).getAttribute('color');
    expect(color.getX(0)).toBeCloseTo(1, 5);
    expect(color.getY(0)).toBeCloseTo(1, 5);
    expect(color.getZ(0)).toBeCloseTo(1, 5);
    b.dispose();
    atlas.dispose();
  });

  it('never writes past capacity', () => {
    const atlas = new GlyphAtlas();
    const b = new AtlasTextMeshBuilder(atlas, 1); // room for one glyph only
    b.addEntity(text({ text: 'ABC' }), atlas, 0xffffff);
    b.flush();
    expect(drawCount(b)).toBe(1 * 6);
    b.dispose();
    atlas.dispose();
  });

  it('drops a non-finite-anchored text (NaN guard) instead of poisoning the mesh', () => {
    const atlas = new GlyphAtlas();
    const b = new AtlasTextMeshBuilder(atlas, 4);
    b.addEntity(text({ text: 'AB', position: { x: NaN, y: 0 } }), atlas, 0xffffff);
    expect(b.isEmpty).toBe(true);
    b.dispose();
    atlas.dispose();
  });

  it('boundingBox stays empty until glyphs are written (frame on the wireframe, not the (0,0,0) tail)', () => {
    const atlas = new GlyphAtlas();
    const b = new AtlasTextMeshBuilder(atlas, 4);
    const box = () => (b.mesh.geometry as THREE.BufferGeometry).boundingBox!;
    expect(box().isEmpty()).toBe(true); // pre-alloc tail must not extend bounds to the origin
    b.addEntity(text({ text: 'A', position: { x: 100, y: 50 } }), atlas, 0xffffff);
    b.flush();
    expect(box().isEmpty()).toBe(false);
    expect(box().min.x).toBeGreaterThan(50); // near the entity, not the origin
    b.dispose();
    atlas.dispose();
  });

  it('positions are all finite (no NaN leaks into the Box3)', () => {
    const atlas = new GlyphAtlas();
    const b = new AtlasTextMeshBuilder(atlas, 2);
    b.addEntity(text({ text: 'A' }), atlas, 0x00ff00);
    const pos = (b.mesh.geometry as THREE.BufferGeometry).getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      expect(Number.isFinite(pos.getX(i))).toBe(true);
      expect(Number.isFinite(pos.getY(i))).toBe(true);
      expect(Number.isFinite(pos.getZ(i))).toBe(true);
    }
    b.dispose();
    atlas.dispose();
  });

  // ── ADR-645 Φάση C — screen-size LOD attribute + frustum-cull finalize ──────────────────────────

  it('bakes a non-zero, same-per-corner aEmVec (glyph vertical extent) for the LOD shader', () => {
    const atlas = new GlyphAtlas();
    const b = new AtlasTextMeshBuilder(atlas, 2);
    b.addEntity(text({ text: 'A', height: 10 }), atlas, 0xffffff);
    const em = (b.mesh.geometry as THREE.BufferGeometry).getAttribute('aEmVec');
    // The vertical edge has a real length (drives on-screen height) …
    const len = Math.hypot(em.getX(0), em.getY(0), em.getZ(0));
    expect(len).toBeGreaterThan(0);
    // … and is identical on all four corners of the glyph quad.
    for (let i = 1; i < 4; i++) {
      expect(em.getX(i)).toBeCloseTo(em.getX(0), 6);
      expect(em.getY(i)).toBeCloseTo(em.getY(0), 6);
      expect(em.getZ(i)).toBeCloseTo(em.getZ(0), 6);
    }
    b.dispose();
    atlas.dispose();
  });

  it('finalize() re-enables frustum culling once glyphs exist, but never for an empty mesh', () => {
    const atlas = new GlyphAtlas();
    const empty = new AtlasTextMeshBuilder(atlas, 4);
    expect(empty.mesh.frustumCulled).toBe(false); // streaming default (bounds fill progressively)
    empty.finalize();
    expect(empty.mesh.frustumCulled).toBe(false); // degenerate sphere → leave culling off

    const filled = new AtlasTextMeshBuilder(atlas, 4);
    filled.addEntity(text({ text: 'A' }), atlas, 0xffffff);
    filled.flush();
    expect(filled.mesh.frustumCulled).toBe(false); // still off mid-stream
    filled.finalize();
    expect(filled.mesh.frustumCulled).toBe(true); // bounds final → three culls off-screen floors

    empty.dispose();
    filled.dispose();
    atlas.dispose();
  });
});
