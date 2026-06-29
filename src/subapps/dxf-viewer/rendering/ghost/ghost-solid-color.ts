/**
 * SSOT — solid (real-colour) stroke/fill for a move/grip-drag's MOVING copy.
 *
 * AutoCAD/Revit parity (ADR-049): the copy that follows the cursor wears the
 * entity's REAL colour at full opacity, while the translucent ghost is the copy
 * left behind at the original position. This resolves that real colour via the
 * canonical layer cascade (ByLayer/ByBlock → layer colour, else the explicit
 * entity colour), exactly like the main canvas paints it.
 *
 * Shared by both move flows so there is ONE colour rule, no duplicated cascade:
 *   - useMovePreview       (toolbar Move tool, 2-click translation)
 *   - useGripGhostPreview  (grip drag — center/vertex/edge/quadrant handles)
 *
 * @see ADR-049 — Unified Move Tool / grip drag SSoT
 */

import { getLayer } from '../../stores/LayerStore';

/** Minimal colour-bearing shape — both `Entity` and BIM scene entities satisfy it. */
interface GhostColorSource {
  readonly color?: string;
  readonly colorMode?: string;
  readonly layerId: string;
}

/**
 * Effective solid colour for an entity's moving preview copy. Returns the layer
 * colour for ByLayer/ByBlock (or when no explicit colour is set), otherwise the
 * entity's explicit colour. Falls back to white when neither resolves.
 */
export function resolveGhostSolidColor(entity: GhostColorSource): string {
  const useLayerColor =
    !entity.color || entity.colorMode === 'ByLayer' || entity.colorMode === 'ByBlock';
  return useLayerColor
    ? (getLayer(entity.layerId)?.color ?? '#FFFFFF')
    : (entity.color ?? '#FFFFFF');
}
