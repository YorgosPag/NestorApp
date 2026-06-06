/**
 * bim-uv-helpers — world-meter UV utilities for PBR texturing (ADR-413).
 *
 * PBR textures tile by `repeat = 1 / tileSizeM` (see `bim-texture-cache.ts`). For
 * tiling to be physically correct, geometry UVs must be expressed in WORLD METERS
 * (1 UV unit = 1 metre). These helpers either reuse the existing auto-UVs (already
 * ~world-scale for ExtrudeGeometry/Box/Tube in 'm' scenes) or generate fresh
 * planar UVs in meters for custom BufferGeometry builders that have none.
 *
 * Both helpers also write `uv2` (a copy of `uv`), required by `aoMap`.
 *
 * Converters helper — pure, no THREE materials, each fn <40 lines.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures.md
 */

import * as THREE from 'three';

/** Dominant-axis options for planar UV projection. */
export interface PlanarUvOptions {
  /**
   * Which world axis the surface mostly faces. The two ORTHOGONAL axes become the
   * U/V plane. Default 'y' (top-down) — suitable for slabs/floors. Use 'x'/'z' for
   * walls facing those axes.
   */
  readonly dominantAxis?: 'x' | 'y' | 'z';
}

/**
 * Ensure a geometry carries texture-ready UVs. If it already has a `uv`
 * attribute (ExtrudeGeometry / BoxGeometry / TubeGeometry auto-UVs, already
 * ~world-scale in meters for 'm' scenes), copy it to `uv2` for `aoMap` and leave
 * `uv` untouched. If it has NO `uv`, fall back to planar world UVs.
 */
export function ensureWorldUvs(geo: THREE.BufferGeometry): void {
  const uv = geo.getAttribute('uv');
  if (!uv) {
    setPlanarWorldUvs(geo, {});
    return;
  }
  if (!geo.getAttribute('uv2')) {
    geo.setAttribute('uv2', new THREE.BufferAttribute(Float32Array.from(uv.array), 2));
  }
}

/** Pick the two position components (in meters) for the U/V plane of an axis. */
function planeComponents(axis: 'x' | 'y' | 'z'): readonly [number, number] {
  if (axis === 'y') return [0, 2]; // top-down → (x, z)
  if (axis === 'x') return [2, 1]; // facing X  → (z, y)
  return [0, 1]; // facing Z → (x, y)
}

/**
 * Generate planar UVs in WORLD METERS by projecting vertex positions onto a
 * plane. Used by custom BufferGeometry builders (column prism, sloped wall wedge,
 * loft band) that carry no `uv`. Writes BOTH `uv` and `uv2` (1 UV unit = 1 m, so
 * `repeat = 1/tileSizeM` tiles physically).
 */
export function setPlanarWorldUvs(geo: THREE.BufferGeometry, opts: PlanarUvOptions): void {
  const pos = geo.getAttribute('position');
  if (!pos) return;
  const [iu, iv] = planeComponents(opts.dominantAxis ?? 'y');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getComponent(i, iu);
    uv[i * 2 + 1] = pos.getComponent(i, iv);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('uv2', new THREE.BufferAttribute(Float32Array.from(uv), 2));
}

/**
 * Box-projected WORLD-METER UVs — per-FACE projection chosen by each vertex's
 * normal, so every face of an axis-aligned box tiles physically (1 UV unit = 1 m)
 * like the main 3D's ExtrudeGeometry auto-UVs. Unlike `setPlanarWorldUvs`, which
 * projects ALL faces onto a single axis (correct only on the faces parallel to
 * it, and STRETCHED into stripes on the perpendicular top/side faces), this maps
 * each face with the two world axes orthogonal to its normal. Used by the «Edit
 * Type» preview band boxes so their textures match the 3D scene (ADR-414).
 */
export function setBoxWorldUvs(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  if (!pos || !nor) {
    setPlanarWorldUvs(geo, {});
    return;
  }
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    // Face normal ~X → (z,y) · ~Y (top/bottom) → (x,z) · ~Z (front/back) → (x,y).
    const [iu, iv] = ax >= ay && ax >= az ? [2, 1] : ay >= az ? [0, 2] : [0, 1];
    uv[i * 2] = pos.getComponent(i, iu);
    uv[i * 2 + 1] = pos.getComponent(i, iv);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('uv2', new THREE.BufferAttribute(Float32Array.from(uv), 2));
}

/** World up — the reference for resolving a face's up-slope vs across-slope axes. */
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** Texcoord scale + rotation for `setSlopeAlignedTileUvs` (ADR-417 #5). */
export interface SlopeTileUvOptions {
  /** Texcoord scale ACROSS the slope (along the ridge). 1 = 1 UV unit per metre. */
  readonly scaleU: number;
  /** Texcoord scale UP the slope (the water-flow direction). 1 = 1 metre. */
  readonly scaleV: number;
  /** Swap U↔V — Revit «texture rotation 90°» (tile grooves on the other image axis). */
  readonly rotate90?: boolean;
}

/**
 * ADR-417 #5 — SLOPE-ALIGNED world-meter UVs for pitched-roof tiles. Unlike
 * `setBoxWorldUvs` (world-AXIS projection — tile grooves run along the ridge,
 * never down-slope, and the normal-map tangent is mis-aligned → reads flat), this
 * builds a per-vertex in-plane frame from the vertex normal: `across` = horizontal
 * ⊥ to the slope (along the ridge), `up` = steepest ascent IN the face plane. The
 * V axis therefore follows the water-flow direction on EVERY «νερό» (hip/gable/
 * mono), so the grooves drain down-slope and the relief tangents are correct.
 *
 * `scaleU`/`scaleV` apply the tile's physical width/length (caller divides the
 * material's base tile size by the desired tile size — see `roof-to-three.ts`), so
 * one shared texture singleton still tiles physically. Near-horizontal faces (flat
 * deck / degenerate) fall back to world (x,z), matching `setBoxWorldUvs`. Vertical
 * side faces get a box-like (horizontal, vertical) frame — they sit behind the
 * fascia/soffit so their tiling is not visually critical. Writes `uv` + `uv2`.
 */
export function setSlopeAlignedTileUvs(geo: THREE.BufferGeometry, opts: SlopeTileUvOptions): void {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  if (!pos || !nor) {
    setPlanarWorldUvs(geo, {});
    return;
  }
  const uv = new Float32Array(pos.count * 2);
  const n = new THREE.Vector3();
  const across = new THREE.Vector3();
  const up = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.set(nor.getX(i), nor.getY(i), nor.getZ(i));
    across.crossVectors(WORLD_UP, n);
    if (across.lengthSq() < 1e-10) {
      across.set(1, 0, 0); // face ~horizontal → world (x,z), like setBoxWorldUvs top
      up.set(0, 0, 1);
    } else {
      across.normalize();
      up.crossVectors(n, across).normalize(); // up-slope, in the face plane
    }
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    let u = p.dot(across) * opts.scaleU;
    let v = p.dot(up) * opts.scaleV;
    if (opts.rotate90) { const t = u; u = v; v = t; }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('uv2', new THREE.BufferAttribute(Float32Array.from(uv), 2));
}
