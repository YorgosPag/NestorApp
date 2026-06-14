/**
 * ADR-457 Slice 3 — Column Reinforcement Detail Sheet · 3D dimension annotations.
 *
 * Builds the overall width / depth / height dimension leaders for the offscreen
 * 3D perspective capture as a `THREE.Group` (dark dimension lines + billboard
 * text sprites). Baked into the same raster as the cage/prism, so the values
 * appear "on the 3D" and survive into the PDF unchanged (preview === PDF).
 *
 * Geometry-is-SSoT: the placement comes from `computeColumnGeometry().footprint`
 * (the column's real world footprint, same frame/units as the cage), the values
 * are the raw `ColumnParams` dimensions in mm (data, not i18n — N.11-safe).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/column-detail-3d-dims
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import * as THREE from 'three';
import type { ColumnEntity } from '../../../types/column-types';
import { computeColumnGeometry } from '../../../geometry/column-geometry';

/** mm → metres (the vertical convention shared with `buildColumnRebarCage`). */
const MM_TO_M = 0.001;
/** Dimension line + text colour (matches the 2D detail dimension hue). */
const DIM_HEX = 0x333333;
/** Dimension-line offset from the column face, as a fraction of the cross-section. */
const OFFSET_FRACTION = 0.5;
/** Text cap height, as a fraction of the cross-section. */
const TEXT_FRACTION = 0.34;
/** Font pixels used to rasterise the sprite label (high → crisp). */
const SPRITE_FONT_PX = 72;
const SPRITE_PAD_PX = 10;

/** A billboard text sprite (canvas texture) of the given world cap-height. */
function makeTextSprite(text: string, worldHeight: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = `bold ${SPRITE_FONT_PX}px sans-serif`;
  let textWidthPx = SPRITE_FONT_PX;
  if (ctx) {
    ctx.font = font;
    textWidthPx = Math.ceil(ctx.measureText(text).width);
  }
  canvas.width = textWidthPx + SPRITE_PAD_PX * 2;
  canvas.height = SPRITE_FONT_PX + SPRITE_PAD_PX * 2;
  if (ctx) {
    ctx.font = font;
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(worldHeight * (canvas.width / canvas.height), worldHeight, 1);
  return sprite;
}

/** Unit XZ normal of edge a→b pointing away from `centroid`. */
function outwardNormal(a: THREE.Vector3, b: THREE.Vector3, centroid: THREE.Vector3): THREE.Vector3 {
  const dir = new THREE.Vector3().subVectors(b, a).setY(0).normalize();
  const n = new THREE.Vector3(-dir.z, 0, dir.x);
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  if (mid.clone().add(n).distanceTo(centroid) < mid.distanceTo(centroid)) n.negate();
  return n;
}

/** Appends one straight dimension (2 extension lines + dim line) + a label. */
function addDimension(
  segments: THREE.Vector3[],
  group: THREE.Group,
  a: THREE.Vector3,
  b: THREE.Vector3,
  out: THREE.Vector3,
  offset: number,
  text: string,
  textHeight: number,
): void {
  const da = a.clone().addScaledVector(out, offset);
  const db = b.clone().addScaledVector(out, offset);
  segments.push(a.clone(), da, b.clone(), db, da.clone(), db.clone()); // ext A, ext B, dim line
  const mid = new THREE.Vector3().addVectors(da, db).multiplyScalar(0.5).addScaledVector(out, textHeight * 0.7);
  const sprite = makeTextSprite(text, textHeight);
  sprite.position.copy(mid);
  group.add(sprite);
}

/**
 * Builds W/D/H dimension annotations for a rectangular column, or `null` for an
 * unsupported kind / degenerate geometry. Positioned at the base footprint edges
 * (width, depth) and a vertical leader at one corner (height).
 */
export function buildColumnDimAnnotations(column: ColumnEntity): THREE.Group | null {
  const { params } = column;
  if (params.kind !== 'rectangular') return null;
  const verts = computeColumnGeometry(params).footprint.vertices;
  if (verts.length < 4) return null;
  const heightM = Math.max(0, params.height) * MM_TO_M;
  if (heightM <= 0) return null;

  const base = verts.slice(0, 4).map((v) => new THREE.Vector3(v.x, 0, -v.y));
  const centroid = base.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(0.25);
  const widthEdge = base[0].distanceTo(base[1]);
  const depthEdge = base[1].distanceTo(base[2]);
  const charSize = Math.max(widthEdge, depthEdge, 1e-4);
  const offset = charSize * OFFSET_FRACTION;
  const textHeight = charSize * TEXT_FRACTION;

  const group = new THREE.Group();
  const segments: THREE.Vector3[] = [];
  addDimension(segments, group, base[0], base[1], outwardNormal(base[0], base[1], centroid), offset, String(Math.round(params.width)), textHeight);
  addDimension(segments, group, base[1], base[2], outwardNormal(base[1], base[2], centroid), offset, String(Math.round(params.depth)), textHeight);

  // Height: vertical leader at the corner furthest along the width edge's outward side.
  const corner = base[1];
  const horizOut = corner.clone().sub(centroid).setY(0).normalize();
  const top = corner.clone().setY(heightM);
  addDimension(segments, group, corner, top, horizOut, offset, String(Math.round(params.height)), textHeight);

  const lineGeo = new THREE.BufferGeometry().setFromPoints(segments);
  group.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: DIM_HEX })));
  return group;
}
