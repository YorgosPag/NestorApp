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
import type { BimCategory, ObjectStyle } from '../../config/bim-object-styles';
import { resolveEntityLayerName } from '../../stores/LayerStore';
import { resolveRenderedColorHex } from '../properties/resolve-entity-style';
import { resolveBimEntityColorHex } from './bim-entity-color';
// ADR-362 — a dimension's rendered colour is its DIMSTYLE `dimclrd` (NOT `entity.color`, which
// dimensions don't carry, and NOT a BIM category). Resolve through the SAME SSoT the
// DimensionRenderer paints with, so "select similar" groups dims by the colour the eye sees.
import type { DimensionEntity } from '../../types/dimension';
import { resolveDimStyle } from '../dimensions/dim-style-resolver';
import { getDimStyleRegistry } from '../dimensions/dim-style-registry';
import { resolveDimColor } from '../../rendering/entities/dimension/dim-color-resolver';

/** Live per-view Object Styles overrides (V/G), keyed by BIM category. */
type ObjectStylesMap = Partial<Record<BimCategory, ObjectStyle>>;

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
 * lowercase for stable comparison.
 *
 * BIM entities resolve through the structural colour-identity SSoT (ADR-445) so
 * "same colour" matches the category/subcategory hue the renderer paints; raw DXF
 * entities fall back to the layer cascade. Returns null only when neither path
 * yields a colour.
 */
export function resolveEntityColorHex(
  entity: Entity,
  layersById: Record<string, SceneLayer>,
  objectStyles?: ObjectStylesMap,
): string | null {
  // Dimension → DIMSTYLE colour (dimclrd) via the renderer's SSoT. Scene entities arrive as the
  // WRAPPED DxfDimension (fields nested under `dimensionEntity`), so unwrap first; without this a
  // dimension resolved to `entity.color` (undefined) → null → "select similar" skipped every dim.
  if (entity.type === 'dimension') {
    const dim = (entity as { dimensionEntity?: DimensionEntity }).dimensionEntity
      ?? (entity as unknown as DimensionEntity);
    if (!dim) return null;
    // Colour is DIMSTYLE-driven and independent of geometry, so a dim with no defPoints still
    // has a valid identity colour (its selectability by marquee is a separate, bounds concern).
    const style = resolveDimStyle(dim, getDimStyleRegistry());
    const layer = findEntityLayer(entity, layersById);
    // resolveDimColor handles ACI 1-255 + ByLayer/ByBlock (uses the layer hex for the latter),
    // matching DimensionRenderer.applyLineStyle exactly.
    return resolveDimColor(style.dimclrd, layer?.color).toLowerCase();
  }

  // BIM entity → structural colour identity (ADR-445). null ⇒ raw DXF, use cascade.
  const bimColor = resolveBimEntityColorHex(entity, objectStyles);
  if (bimColor !== null) return bimColor;

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
  objectStyles?: ObjectStylesMap,
): string[] {
  const reference = entities.find(e => e.id === referenceId);
  if (!reference) return [];
  const targetColor = resolveEntityColorHex(reference, layersById, objectStyles);
  if (!targetColor) return [];

  const matches: string[] = [];
  for (const entity of entities) {
    if (entity.visible === false) continue;
    if (resolveEntityColorHex(entity, layersById, objectStyles) === targetColor) {
      matches.push(entity.id);
    }
  }
  return matches;
}
