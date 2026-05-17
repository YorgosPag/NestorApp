/**
 * ADR-358 Phase 14 — Scene V1→V2 migration helpers.
 *
 * Scenes persisted before ADR-358 Phase 1 (2026-05-16) have SceneLayer objects
 * with only 4 fields: name, color, visible, locked.
 * This helper fills the missing fields with canonical defaults so the rest of
 * the system (LayerStore, resolveEntityStyle, DXF writer) works correctly.
 *
 * Design: id = mapKey (layer name used as slug).
 *   Legacy `layersById` entries are keyed by layer NAME (former `layers` map).
 *   Re-using the name as the stable id preserves the entity→layer link without
 *   a second pass over entity.layerId. Subsequent renames via LayerOperationsService
 *   keep the id stable (only SceneLayer.name changes — ADR-358 Phase 9D-5a).
 */

import { createSceneLayer, type SceneLayer } from '../types/entities';
import { DEFAULT_LINETYPE_NAME } from '../config/linetype-iso-catalog';

/** Raw shape from a pre-ADR-358 Firestore scene JSON — partial at best. */
type LegacyLayerRaw = Partial<SceneLayer> & Record<string, unknown>;

/**
 * Upgrade a legacy (pre-ADR-358) layer object to a full SceneLayer.
 * Idempotent: already-migrated layers (all required fields present) pass through.
 *
 * @param mapKey - Key used in `layersById` (= layer name for legacy scenes).
 * @param raw    - Raw layer data from Firestore JSON (unknown shape).
 */
export function migrateSceneLayerV1ToV2(
  mapKey: string,
  raw: LegacyLayerRaw,
): SceneLayer {
  if (isAlreadyMigrated(raw)) return raw as unknown as SceneLayer;

  return createSceneLayer({
    id: (typeof raw.id === 'string' && raw.id.length > 0) ? raw.id : mapKey,
    name: (typeof raw.name === 'string') ? raw.name : mapKey,
    color: (typeof raw.color === 'string') ? raw.color : '#ffffff',
    visible: (typeof raw.visible === 'boolean') ? raw.visible : true,
    locked: (typeof raw.locked === 'boolean') ? raw.locked : false,
    colorAci: raw.colorAci as number | undefined,
    colorTrueColor: raw.colorTrueColor as number | null | undefined,
    linetype: (typeof raw.linetype === 'string') ? raw.linetype : DEFAULT_LINETYPE_NAME,
    lineweight: raw.lineweight as SceneLayer['lineweight'],
    transparency: (typeof raw.transparency === 'number') ? raw.transparency : 0,
    frozen: (typeof raw.frozen === 'boolean') ? raw.frozen : false,
    plottable: (typeof raw.plottable === 'boolean') ? raw.plottable : true,
    description: raw.description as string | undefined,
    source: (raw.source === 'dxf-import' || raw.source === 'user-created' || raw.source === 'system-default')
      ? raw.source
      : 'dxf-import',
    createdAt: raw.createdAt as string | undefined,
    category: raw.category as SceneLayer['category'],
    tags: raw.tags as ReadonlyArray<string> | undefined,
    bimCategory: (raw.bimCategory !== undefined) ? raw.bimCategory as string | null : null,
    vpOverrides: (raw.vpOverrides !== undefined) ? raw.vpOverrides as Record<string, never> | null : null,
  });
}

/**
 * Migrate all entries in a raw `layersById` map (import-time boundary).
 * Returns a new map — original untouched.
 */
export function migrateLayersById(
  rawMap: Record<string, LegacyLayerRaw>,
): Record<string, SceneLayer> {
  const result: Record<string, SceneLayer> = {};
  for (const [key, raw] of Object.entries(rawMap)) {
    result[key] = migrateSceneLayerV1ToV2(key, raw);
  }
  return result;
}

/**
 * Returns true when the raw object has all fields introduced in ADR-358 Phase 1.
 * Used to short-circuit migration for already-upgraded scenes (idempotent guard).
 */
function isAlreadyMigrated(raw: LegacyLayerRaw): boolean {
  return (
    typeof raw.id === 'string' && raw.id.length > 0 &&
    typeof raw.name === 'string' &&
    typeof raw.color === 'string' &&
    typeof raw.visible === 'boolean' &&
    typeof raw.locked === 'boolean' &&
    typeof raw.linetype === 'string' &&
    raw.lineweight !== undefined &&
    typeof raw.transparency === 'number' &&
    typeof raw.frozen === 'boolean' &&
    typeof raw.plottable === 'boolean' &&
    typeof raw.source === 'string'
  );
}
