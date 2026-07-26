/**
 * dxf-overlay-entity-color — the DXF→Three.js colour cascade for the 3D overlay, extracted from
 * `DxfToThreeConverter` (N.7.1 SRP file-size split; the converter owns geometry, this owns colour).
 *
 * Cascade per entity (unchanged, byte-for-byte, from the inline version):
 *   colorTrueColor > colorAci > concrete entity.color > ByLayer cascade:
 *   layer.colorTrueColor > layer.colorAci > layer.color hex > 0xffffff.
 *
 * NOTE — this is the *3D overlay* resolver (returns a Three.js colour int). The 2D/logical
 * counterpart is `resolveEntityColorHex` (systems/properties/resolve-entity-color.ts); they answer
 * different questions (int for a LineSegments material vs hex for the canvas/UI) and must not be merged.
 */

import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneLayer } from '../../types/entities';
import { ACI_PALETTE } from '../../settings/standards/aci';
// 🏢 ADR-571: hex→int SSoT (μηδέν local parseInt duplicate)
import { hexToTrueColor } from '../../utils/dxf-true-color';

const DEFAULT_COLOR = 0xffffff;

// ACI_PALETTE values are CSS hex strings '#RRGGBB'. Cast for numeric index access.
const ACI_MAP = ACI_PALETTE as unknown as Record<number, string | undefined>;

function aciToInt(aci: number): number {
  const hex = ACI_MAP[aci];
  if (!hex) return DEFAULT_COLOR;
  return hexToTrueColor(hex); // ADR-571 SSoT
}

function hexCssToInt(hex: string): number {
  // ADR-571: delegate το parse στο hexToTrueColor SSoT· κρατά το DEFAULT_COLOR fallback σε άκυρο hex.
  return /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex.trim()) ? hexToTrueColor(hex) : DEFAULT_COLOR;
}

function resolveLayer(
  entity: DxfEntityUnion,
  layersById: Record<string, SceneLayer> | undefined,
): SceneLayer | undefined {
  // ADR-358 Phase 9D-5a: id-only resolution (entity-layer-id-canonical SSoT).
  // Legacy `entity.layer` name backref forbidden in new code.
  if (!layersById || !entity.layerId) return undefined;
  return layersById[entity.layerId];
}

function layerColorToInt(layer: SceneLayer): number {
  if (layer.colorTrueColor != null) return layer.colorTrueColor & 0xFFFFFF;
  if (layer.colorAci !== undefined) return aciToInt(layer.colorAci);
  if (layer.color) return hexCssToInt(layer.color);
  return DEFAULT_COLOR;
}

/** Resolve final Three.js color integer for a DXF entity.
 *  Exported for unit testing. */
export function resolveEntityColor(
  entity: DxfEntityUnion,
  layersById: Record<string, SceneLayer> | undefined,
): number {
  if (entity.colorTrueColor != null) return entity.colorTrueColor & 0xFFFFFF;

  const byLayer = entity.colorMode === 'ByLayer'
    || entity.colorMode === 'ByBlock'
    || (!entity.color && entity.colorAci === undefined);

  if (!byLayer) {
    if (entity.colorAci !== undefined) return aciToInt(entity.colorAci);
    if (entity.color) return hexCssToInt(entity.color);
  }

  const layer = resolveLayer(entity, layersById);
  return layer ? layerColorToInt(layer) : DEFAULT_COLOR;
}
