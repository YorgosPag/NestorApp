/**
 * ADR-362 Phase C1 — DIMSTYLE color resolution (ACI → CSS hex).
 *
 * DIMSTYLE colour variables (DIMCLRD / DIMCLRE / DIMCLRT) carry an AutoCAD
 * Color Index (ACI 1-255) plus two sentinels:
 *   - 0   = ByBlock   (resolve via parent block's colour — N/A for free dims)
 *   - 256 = ByLayer   (resolve via the dim entity's owning layer)
 *
 * Phase C1 scope: convert ACI 1-255 to hex via the centralised palette
 * (`settings/standards/aci.ts`). ByBlock + ByLayer fall back to the supplied
 * layer colour (or default white when absent). Block resolution (D6) lands in
 * Phase H — until then ByBlock behaves identically to ByLayer.
 */

import { getAciColor } from '../../../settings/standards/aci';
import { CAD_UI_COLORS } from '../../../config/color-config';
import { trueColorToHex } from '../../../utils/dxf-true-color';

const ACI_BYBLOCK = 0;
const ACI_BYLAYER = 256;

/**
 * Resolve a DIMSTYLE colour variable to a CSS hex string.
 *
 * @param aci          - DIMSTYLE colour code (0=ByBlock, 1-255=ACI, 256=ByLayer)
 * @param layerColour  - Owning layer hex colour (used for ByLayer/ByBlock fallback)
 */
export function resolveDimColor(aci: number, layerColour?: string): string {
  if (aci === ACI_BYLAYER || aci === ACI_BYBLOCK) {
    return layerColour ?? CAD_UI_COLORS.entity.default;
  }
  if (!Number.isFinite(aci) || aci < 1 || aci > 255) {
    return CAD_UI_COLORS.entity.default;
  }
  return getAciColor(aci);
}

/**
 * ADR-562 Φ7 — resolve a DIMSTYLE colour channel with true-color priority.
 *
 * When a true-color companion is set (`!= null`, packed `0xRRGGBB`) it wins and
 * renders the EXACT hex chosen in the ribbon color picker. Otherwise falls back
 * to the ACI channel via `resolveDimColor` (identical ByLayer/ByBlock behaviour).
 *
 * @param trueColor   - packed 24-bit true-color companion (or null/undefined)
 * @param aci         - the ACI colour code (0=ByBlock, 1-255=ACI, 256=ByLayer)
 * @param layerColour - owning layer hex (ByLayer/ByBlock fallback)
 */
export function resolveDimColorTC(
  trueColor: number | null | undefined,
  aci: number,
  layerColour?: string,
): string {
  if (trueColor != null) return trueColorToHex(trueColor);
  return resolveDimColor(aci, layerColour);
}
