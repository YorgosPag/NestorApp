/**
 * ADR-639 Στάδιο 5 — WebGL line-layer buffer builder (pure).
 *
 * Iterates the scene ONCE, keeps every entity that `isWebglOwnedLine` accepts, and
 * packs the resulting straight segments into per-bucket typed arrays that the manager
 * (STEP 9) uploads into persistent `LineSegments2` geometry. Built ONCE per scene
 * identity — pan/zoom never touches it (that is the whole point of Στάδιο 5).
 *
 * Buckets group by (quantized lineWidthPx, quantized alpha) because
 * `LineMaterial.linewidth`/`opacity` are single uniforms; colour rides per-vertex.
 * Real permit files have ~1-4 distinct BYLAYER lineweights → a handful of buckets.
 * `MAX_BUCKETS` is a backstop: if a pathological file exceeds it, the least-populated
 * surplus buckets are dropped and their entity ids are LEFT OUT of `ownedEntityIds`,
 * so those lines fall back to Canvas2D. The DxfRenderer suppression (STEP 12) reads
 * `ownedEntityIds` — the exact set this builder materialised — so the GPU set and the
 * Canvas2D-suppressed set can never diverge (no gap, no double-draw), even under the cap.
 *
 * COLOUR: `resolved.colorHex` (sRGB) → THREE.Color → LINEAR rgb (ColorManagement is
 * left ON — see `webgl-line-renderer-setup.ts`). The output sRGB OETF reproduces the
 * exact Canvas2D hex. No three global is mutated.
 *
 * Only straight geometry reaches here: `isWebglOwnedLine` already rejects bulged /
 * width-band polylines, so there is no arc tessellation in this module.
 *
 * @see is-webgl-owned-line.ts — the shared ownership gate
 * @see dxf-renderer-style-resolve.ts — resolveEntityRenderStyle (same SSoT as Canvas2D)
 */

import * as THREE from 'three';
import type { DxfEntityUnion, DxfLine, DxfPolyline } from '../dxf-canvas/dxf-types';
import type { ResolvedRenderStyle } from '../dxf-canvas/dxf-renderer-style-resolve';
import { isWebglOwnedLine, type WebglLineOwnershipContext } from './is-webgl-owned-line';

/** Fat-line buckets cap → ≤ this many draw calls for the whole scene (blueprint budget). */
export const MAX_BUCKETS = 16;

/** One GPU bucket: uniform width+alpha, per-vertex colour, sorted DESC by length (LOD). */
export interface WebglLineBucket {
  /** Representative width (px, pre-DPR) → LineMaterial.linewidth. */
  readonly lineWidthPx: number;
  /** Representative alpha → LineMaterial.opacity. */
  readonly alpha: number;
  /** xyz per vertex, 2 vertices/segment: [ax,ay,0, bx,by,0, …]. */
  readonly positions: Float32Array;
  /** Linear rgb per vertex, 2/segment (both endpoints share the entity colour). */
  readonly colors: Float32Array;
  /** World length per segment, sorted DESC — the LOD binary-search input. */
  readonly worldLengths: Float32Array;
}

export interface WebglLineBuildResult {
  readonly buckets: readonly WebglLineBucket[];
  /** Exact set of entity ids the GPU owns; STEP 12 suppresses Canvas2D iff a member. */
  readonly ownedEntityIds: ReadonlySet<string>;
}

interface Segment {
  ax: number; ay: number; bx: number; by: number;
  r: number; g: number; b: number;
  len: number;
}

interface BucketAccum {
  lineWidthPx: number;
  alpha: number;
  segments: Segment[];
  entityIds: Set<string>;
}

/** Snap to 0.1px / 0.01 alpha so float noise collapses but visual fidelity holds. */
function bucketKey(lineWidthPx: number, alpha: number): string {
  return `${Math.round(lineWidthPx * 10) / 10}|${Math.round(alpha * 100) / 100}`;
}

const _color = new THREE.Color();
/** sRGB hex → linear rgb (ColorManagement ON converts the input on `setStyle`). */
function hexToLinearRgb(hex: string): [number, number, number] {
  _color.setStyle(hex);
  return [_color.r, _color.g, _color.b];
}

/** Straight-segment endpoints for a LINE or plain polyline (world coords). */
function entitySegmentEndpoints(entity: DxfEntityUnion): Array<[number, number, number, number]> {
  if (entity.type === 'line') {
    const l = entity as DxfLine;
    return [[l.start.x, l.start.y, l.end.x, l.end.y]];
  }
  const p = entity as DxfPolyline;
  const v = p.vertices;
  const out: Array<[number, number, number, number]> = [];
  for (let i = 0; i < v.length - 1; i++) out.push([v[i].x, v[i].y, v[i + 1].x, v[i + 1].y]);
  if (p.closed && v.length > 1) out.push([v[v.length - 1].x, v[v.length - 1].y, v[0].x, v[0].y]);
  return out;
}

/** Accumulate one owned entity's segments into its (width,alpha) bucket. */
function pushEntity(
  entity: DxfEntityUnion,
  colorHex: string,
  lineWidthPx: number,
  alpha: number,
  buckets: Map<string, BucketAccum>,
): void {
  const [r, g, b] = hexToLinearRgb(colorHex);
  const key = bucketKey(lineWidthPx, alpha);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { lineWidthPx, alpha, segments: [], entityIds: new Set() };
    buckets.set(key, bucket);
  }
  bucket.entityIds.add(entity.id);
  for (const [ax, ay, bx, by] of entitySegmentEndpoints(entity)) {
    bucket.segments.push({ ax, ay, bx, by, r, g, b, len: Math.hypot(bx - ax, by - ay) });
  }
}

/** Pack one accumulator's segments (sorted DESC by length) into typed arrays. */
function finalizeBucket(accum: BucketAccum): WebglLineBucket {
  const segments = accum.segments.slice().sort((a, b) => b.len - a.len);
  const n = segments.length;
  const positions = new Float32Array(n * 6);
  const colors = new Float32Array(n * 6);
  const worldLengths = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = segments[i];
    const p = i * 6;
    positions[p] = s.ax; positions[p + 1] = s.ay; positions[p + 2] = 0;
    positions[p + 3] = s.bx; positions[p + 4] = s.by; positions[p + 5] = 0;
    colors[p] = s.r; colors[p + 1] = s.g; colors[p + 2] = s.b;
    colors[p + 3] = s.r; colors[p + 4] = s.g; colors[p + 5] = s.b;
    worldLengths[i] = s.len;
  }
  return { lineWidthPx: accum.lineWidthPx, alpha: accum.alpha, positions, colors, worldLengths };
}

/**
 * Build the GPU line buffers for a scene. `resolveStyle` and `isLayerSkipped` are
 * injected so this module stays pure and testable; the manager (STEP 9) wires the
 * real `resolveEntityRenderStyle(e, layersById)` (the SAME SSoT the Canvas2D batch
 * key uses → GPU and Canvas2D colours/widths never diverge) and the DxfRenderer's
 * frozen/cut-plane/visibility logic. Selection/hover are always-false here — ADR-040
 * rule 3: the buffer is independent of interaction state (selected lines stay in the
 * GPU buffer and are overpainted by the Canvas2D overlay).
 */
export function buildWebglLineBuffers(
  entities: readonly DxfEntityUnion[],
  resolveStyle: (entity: DxfEntityUnion) => ResolvedRenderStyle,
  isLayerSkipped: (entity: DxfEntityUnion) => boolean,
): WebglLineBuildResult {
  const ctx: WebglLineOwnershipContext = {
    isLayerSkipped,
    isSelected: () => false,
    isHovered: () => false,
  };

  const buckets = new Map<string, BucketAccum>();
  for (const entity of entities) {
    const resolved = resolveStyle(entity);
    if (!isWebglOwnedLine(entity, resolved, ctx)) continue;
    pushEntity(entity, resolved.colorHex, resolved.lineWidthPx, resolved.alpha, buckets);
  }

  // Backstop cap: keep the most-populated buckets; surplus entities fall back to Canvas2D.
  const kept = [...buckets.values()]
    .sort((a, b) => b.segments.length - a.segments.length)
    .slice(0, MAX_BUCKETS);

  const ownedEntityIds = new Set<string>();
  for (const accum of kept) for (const id of accum.entityIds) ownedEntityIds.add(id);

  return { buckets: kept.map(finalizeBucket), ownedEntityIds };
}
