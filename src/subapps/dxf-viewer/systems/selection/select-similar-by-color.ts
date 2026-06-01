/**
 * Select Similar by Color — AutoCAD / BricsCAD "Select Similar" (color filter).
 *
 * Given a reference entity, returns the ids of every entity in the scene whose
 * RESOLVED display color equals the reference's — across ALL entity kinds
 * (line / circle / polyline / rectangle / arc / ...).
 *
 * 🔑 The match is on the *effective* (rendered) color hex, NOT the raw
 * `entity.color`. A DXF color can be explicit hex, ByLayer, ACI index, or
 * TrueColor; only the resolved hex tells you what the eye actually sees as
 * "orange". This reuses the SAME SSoT the renderer uses (`resolveEntityStyle`),
 * so "same color" here is identical to "same color" on the canvas.
 *
 * @see systems/properties/resolve-entity-style.ts — color SSoT (renderer shares it)
 * @see canvas-v2/dxf-canvas/DxfRenderer.ts — resolveLayerStyle (mirrored color path)
 * @see ADR-030 Universal Selection System
 */

import type { Entity, SceneLayer } from '../../types/entities';
import { resolveEntityLayerName } from '../../stores/LayerStore';
import { resolveRenderedColorHex } from '../properties/resolve-entity-style';

/**
 * Locate the entity's layer in the id-keyed map. Mirrors DxfRenderer's lookup:
 * id-keyed first, then name-keyed fallback (legacy / Firestore scenes).
 */
function findEntityLayer(
  entity: Entity,
  layersById: Record<string, SceneLayer>,
): SceneLayer | undefined {
  const byId = entity.layerId ? layersById[entity.layerId] : undefined;
  if (byId) return byId;
  const name = resolveEntityLayerName(entity);
  return name ? layersById[name] : undefined;
}

/**
 * Resolve the effective (rendered) color hex for a single entity, normalized to
 * lowercase for stable comparison. Returns null only when there is no layer and
 * no explicit color to fall back to.
 */
export function resolveEntityColorHex(
  entity: Entity,
  layersById: Record<string, SceneLayer>,
): string | null {
  const layer = findEntityLayer(entity, layersById);
  // No layer context → fall back to the explicit color (renderer fallback path).
  if (!layer) return entity.color ? entity.color.toLowerCase() : null;
  // SSoT wrapper — keeps the resolveEntityStyle() cascade inside resolve-entity-
  // style.ts (ADR-358 §G7) so "same color" matches exactly what the canvas paints.
  return resolveRenderedColorHex(
    {
      color: entity.color,
      colorMode: entity.colorMode,
      colorAci: entity.colorAci,
      colorTrueColor: entity.colorTrueColor,
      linetypeName: entity.linetypeName,
      lineweightMm: entity.lineweightMm,
      transparency: entity.transparency,
    },
    layer,
  );
}

/**
 * Find every entity whose resolved color matches the reference entity's.
 * Includes the reference itself. Hidden entities (`visible === false`) are
 * excluded — they are not pickable on the canvas, so selecting them would be
 * surprising. Returns [] when the reference is missing or has no resolvable
 * color.
 */
export function findEntitiesWithSimilarColor(
  referenceId: string,
  entities: readonly Entity[],
  layersById: Record<string, SceneLayer>,
): string[] {
  const reference = entities.find(e => e.id === referenceId);
  if (!reference) return [];
  const targetColor = resolveEntityColorHex(reference, layersById);
  if (!targetColor) return [];

  const matches: string[] = [];
  for (const entity of entities) {
    if (entity.visible === false) continue;
    if (resolveEntityColorHex(entity, layersById) === targetColor) {
      matches.push(entity.id);
    }
  }
  return matches;
}
