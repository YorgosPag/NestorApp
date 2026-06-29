/**
 * SSOT — solid (real-colour) stroke/fill for a move/grip-drag's MOVING copy.
 *
 * AutoCAD/Revit parity (ADR-049): the copy that follows the cursor wears the
 * entity's REAL colour at full opacity, while the translucent ghost is the copy
 * left behind at the original position.
 *
 * The colour is the EFFECTIVE rendered hex, resolved through the SAME canonical
 * SSoT the canvas and "Select Similar by colour" use (`resolveEntityColorHex`
 * → `resolveEntityStyle`). So the moving copy matches EXACTLY what the eye sees
 * on the canvas for every colour mode — ByLayer / ByBlock / ACI index / TrueColor
 * / BIM category identity — not an approximation.
 *
 * Shared by both move flows so there is ONE colour rule, zero duplicated cascade:
 *   - useMovePreview       (toolbar Move tool, 2-click translation)
 *   - useGripGhostPreview  (grip drag — center/vertex/edge/quadrant handles)
 *
 * @see systems/selection/select-similar-by-color.ts — resolveEntityColorHex (colour SSoT)
 * @see systems/properties/resolve-entity-style.ts — resolveEntityStyle cascade
 * @see ADR-049 — Unified Move Tool / grip drag SSoT
 */

import type { Entity } from '../../types/entities';
import { getLayersById } from '../../stores/LayerStore';
import { resolveEntityColorHex } from '../../systems/selection/select-similar-by-color';

/**
 * Effective rendered colour for an entity's moving preview copy. Delegates to the
 * canonical colour resolver against the live layer table; falls back to white only
 * when no colour resolves (e.g. an entity with neither colour nor a known layer).
 */
export function resolveGhostSolidColor(entity: Entity): string {
  return resolveEntityColorHex(entity, getLayersById()) ?? '#FFFFFF';
}
