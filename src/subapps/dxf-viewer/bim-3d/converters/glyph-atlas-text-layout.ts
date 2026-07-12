/**
 * glyph-atlas-text-layout.ts — PURE layout of a DXF text entity into per-glyph quads for the
 * shared glyph atlas (ADR-645 Φάση B). Given the entity, its resolved font and an atlas glyph
 * source (advance + quad extents + UV per char), it emits the plan-space corners + atlas UVs of
 * every ink glyph. The `glyph-atlas-text-mesh` builder maps each corner (x,y)→(x,0,−y) into the
 * floor-plane BufferGeometry and tints it with the entity colour.
 *
 * PARITY (ADR-557): this reproduces the SAME placement the per-text `CanvasTexture` used —
 *   • anchor = the NOMINAL em box CENTRE (`resolveTextEmBox`), the SAME anchor the 3D hover halo
 *     (`dxf-entity-outline` text case) reads, so glyph + halo coincide;
 *   • lines split + stacked via the `text-lines` SSoT, each line horizontally CENTRED in the box
 *     (mirroring the old `textAlign:'center'` canvas), block vertically centred on the anchor;
 *   • `widthFactor` X-scales the layout, the AutoCAD oblique angle shears it (world y-up
 *     `obliqueShearFromAngle`, the SAME map the em box uses), `\T` tracking spaces the pen — all
 *     applied per glyph corner so the quads lean/stretch exactly like the box parallelogram;
 *   • rotation = the plan `rotation`, applied as a plan-space rotate + the DXF→Three y→−z map,
 *     which is algebraically identical to the old `orientTextPlane` flat+spin quaternion.
 *
 * Deviation from the old kerned run (honest, ADR-645 §7): the atlas advances glyph-by-glyph
 * (single-glyph advance × tracking), so cross-glyph KERNING is dropped — sub-unit for CAD fonts,
 * and the price of one shared atlas (a raster atlas trades pixel kerning for one draw call).
 *
 * Import-time pure: zero THREE / React / DOM. Fully jest-driveable with a fake glyph source.
 */

import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import { getTextHeightWithFallback } from '../../config/text-rendering-config';
import { resolveTextEmBox } from '../../bim/text/text-box';
import { splitTextLines, resolveLineSpacingRatio } from '../../bim/text/text-lines';
import { obliqueShearFromAngle } from '../../bim/text/text-oblique';
import type { TextFontResolution } from './dxf-text-font-resolution';

const DEG_TO_RAD = Math.PI / 180;

/** Font-level vertical metrics as em ratios (glyph height = 1) — uniform per resolved face. */
export interface FontMetricsEm {
  /** Ascender above baseline ÷ em. */
  readonly ascentEm: number;
  /** Descender below baseline ÷ em (positive magnitude). */
  readonly descentEm: number;
}

/**
 * One atlas cell for a glyph: its pen advance + the quad extents (em, relative to the pen origin
 * at baseline-left, y-up) + the atlas UV rect. `hasInk=false` (whitespace / no-glyph) → advance
 * only, no quad emitted. Extents include the texture pad margin so the quad frames the drawn ink.
 */
export interface GlyphCell {
  readonly hasInk: boolean;
  /** Pen advance ÷ em (before `\T` tracking, before `widthFactor`). */
  readonly advanceEm: number;
  /** Quad LEFT edge from the pen origin ÷ em (≤ 0). */
  readonly leftEm: number;
  /** Quad RIGHT edge from the pen origin ÷ em. */
  readonly rightEm: number;
  /** Quad TOP edge above the baseline ÷ em (> 0). */
  readonly topEm: number;
  /** Quad BOTTOM edge below the baseline ÷ em (< 0). */
  readonly bottomEm: number;
  /** Atlas UV rect (flipY=false: v0 = top row, v1 = bottom row). */
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

/** Supplies per-glyph atlas cells + the font metrics for ONE text entity's resolved face. */
export interface GlyphLayoutSource {
  readonly fontMetrics: FontMetricsEm;
  /** The atlas cell for `char` (rasterised on first use by the atlas). */
  getCell(char: string): GlyphCell;
}

/** One laid-out glyph quad: plan-space corners (native DXF units) TL→TR→BR→BL + atlas UV rect. */
export interface GlyphQuad {
  readonly x0: number; readonly y0: number; // TL
  readonly x1: number; readonly y1: number; // TR
  readonly x2: number; readonly y2: number; // BR
  readonly x3: number; readonly y3: number; // BL
  readonly u0: number; readonly v0: number;
  readonly u1: number; readonly v1: number;
}

/** Local (u,v) box-relative point → plan (x,y): rotate by `rot` (rad) about origin, translate to C. */
function toPlan(u: number, v: number, cos: number, sin: number, cx: number, cy: number): { x: number; y: number } {
  return { x: cx + u * cos - v * sin, y: cy + u * sin + v * cos };
}

/** Total pen advance (units, widthFactor=1) of a line's ink+space glyphs, tracking applied. */
function lineAdvanceUnits(line: string, source: GlyphLayoutSource, emUnits: number, tracking: number): number {
  let adv = 0;
  for (const ch of line) adv += source.getCell(ch).advanceEm * emUnits * tracking;
  return adv;
}

/** Frame constants shared by every glyph of one text entity (anchor, rotation, scale, shear). */
interface LayoutFrame {
  readonly cos: number; readonly sin: number;
  readonly cx: number; readonly cy: number;
  readonly emUnits: number;
  readonly widthFactor: number;
  readonly worldShear: number;
  readonly tracking: number;
  /** baseline v relative to its line centre (units): −(ascent−descent)/2·em (baseline='middle'). */
  readonly baseV: number;
}

/** Emit the four plan corners + UV of ONE ink glyph at pen position `penU` on line-centre `vCenter`. */
function emitGlyphQuad(cell: GlyphCell, penU: number, vCenter: number, f: LayoutFrame): GlyphQuad {
  const em = f.emUnits;
  const leftU = penU + cell.leftEm * em;
  const rightU = penU + cell.rightEm * em;
  const topLC = f.baseV + cell.topEm * em;    // v relative to line centre
  const botLC = f.baseV + cell.bottomEm * em;
  // Per corner: widthFactor X-scale + oblique shear (about the line centre, world y-up), then lift
  // to the box centre (+vCenter), then rotate + translate to plan.
  const corner = (u: number, vLC: number): { x: number; y: number } =>
    toPlan(u * f.widthFactor + f.worldShear * vLC, vLC + vCenter, f.cos, f.sin, f.cx, f.cy);
  const tl = corner(leftU, topLC), tr = corner(rightU, topLC);
  const br = corner(rightU, botLC), bl = corner(leftU, botLC);
  return {
    x0: tl.x, y0: tl.y, x1: tr.x, y1: tr.y, x2: br.x, y2: br.y, x3: bl.x, y3: bl.y,
    u0: cell.u0, v0: cell.v0, u1: cell.u1, v1: cell.v1,
  };
}

/**
 * Lay out `entity`'s glyphs into plan-space quads for the shared atlas. Returns `[]` for empty
 * text. Anchored on the em-box centre, lines centred + stacked, widthFactor / oblique / tracking /
 * rotation applied per corner (see the module note) so the atlas glyphs sit exactly where the old
 * per-text plane sat.
 */
export function layoutTextGlyphs(
  entity: DxfText,
  font: TextFontResolution,
  source: GlyphLayoutSource,
): GlyphQuad[] {
  if (!entity.text || !entity.text.trim()) return [];
  const emUnits = getTextHeightWithFallback(undefined, entity.height);
  const lines = splitTextLines(entity.text);
  const lineAdvUnits = emUnits * resolveLineSpacingRatio(entity);
  const blockUnits = emUnits + (lines.length - 1) * lineAdvUnits;
  const box = resolveTextEmBox(entity);
  const rot = (box.rotationDeg ?? 0) * DEG_TO_RAD;
  const fm = source.fontMetrics;
  const f: LayoutFrame = {
    cos: Math.cos(rot), sin: Math.sin(rot), cx: box.center.x, cy: box.center.y,
    emUnits, widthFactor: font.widthFactor, worldShear: obliqueShearFromAngle(entity.textStyle?.obliqueAngle),
    tracking: font.tracking, baseV: -((fm.ascentEm - fm.descentEm) / 2) * emUnits,
  };

  const quads: GlyphQuad[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0) continue;
    const vCenter = blockUnits / 2 - emUnits / 2 - i * lineAdvUnits; // line centre, up from box centre
    let penU = -lineAdvanceUnits(line, source, emUnits, f.tracking) / 2; // centre the line
    for (const ch of line) {
      const cell = source.getCell(ch);
      if (cell.hasInk) quads.push(emitGlyphQuad(cell, penU, vCenter, f));
      penU += cell.advanceEm * emUnits * f.tracking;
    }
  }
  return quads;
}
