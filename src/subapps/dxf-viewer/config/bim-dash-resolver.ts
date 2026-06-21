/**
 * BIM Dash Resolver — ADR-510 Φ2C (BIM linetype SSoT bridge).
 *
 * Replaces the legacy fixed-px `linePatternToDashArray` (ADR-377, `bim-line-patterns.ts`)
 * for the 2D BIM renderers. A BIM pattern key (`'dashed'`, `'hiddenX2'`, …) now
 * resolves through the SAME metric catalog as the DXF entity linetypes
 * (`resolveAnyLinetype` → mm) and is scaled to screen px **zoom-aware** (× LTSCALE),
 * so a dashed BIM wall and a dashed DXF line look identical at any zoom — the
 * Revit/AutoCAD model-space behaviour.
 *
 * 3D edges keep their own world-unit path (Three.js LineMaterial dashSize in m);
 * see `bimDashMm` for that consumer.
 */

import { resolveAnyDashMm } from './linetype-aliases';
import { dashMmToScreenPx } from '../rendering/linetype-dash-resolver';
import { getLinetypeScale } from '../stores/LinetypeScaleStore';
import type { LinePatternKey } from './bim-line-patterns';

/**
 * Resolve a BIM pattern key to its metric pattern (mm) from the unified catalog.
 * `'solid'` / unknown / `custom_*` → `[]` (solid). Used by 3D edges (world units)
 * and as the shared source for the 2D px path below.
 */
export function bimDashMm(key: LinePatternKey): ReadonlyArray<number> {
  return resolveAnyDashMm(key);
}

/**
 * Resolve a BIM pattern key directly to a canvas `setLineDash` array (screen px),
 * zoom-aware (× LTSCALE). Drop-in for the 2D BIM renderers:
 *   `ctx.setLineDash(bimDashPx(key, this.transform.scale))`.
 *
 * @param key   BIM pattern key (ADR-377).
 * @param scale World→screen factor (`renderer.transform.scale`).
 * @returns px dash array; `[]` for solid (zero-allocation native solid path).
 */
export function bimDashPx(key: LinePatternKey, scale: number): number[] {
  return dashMmToScreenPx(bimDashMm(key), scale, getLinetypeScale());
}
