/**
 * layer-smart-filters.ts — Auto-generated smart filters (ADR-358 §5.7.bis Q11, Phase 11).
 *
 * Smart filters are DERIVED from the LayerStore snapshot — NOT persisted.
 * Their ids are DETERMINISTIC strings (`lfs_visible`, `lfs_category_architectural`, …)
 * so that `activeFilters` references survive DXF reload. Smart filter ids are
 * intentionally NOT enterprise IDs: they are not Firestore docs and N.6 does
 * not apply.
 *
 * Output set (re-computed on snapshot change):
 *   1. `lfs_visible`         — visible === true
 *   2. `lfs_locked`          — locked === true
 *   3. `lfs_frozen`          — frozen === true
 *   4. `lfs_not_plotted`     — plottable === false
 *   5. `lfs_empty_layers`    — layer has zero entity members
 *   6. `lfs_category_<cat>`  — one per AEC category present in the scene
 *
 * Pre-commit ratchet `layer-filter-engine` restricts `\bgetSmartFilters\b` to
 * allowlist files.
 */

import type { SceneLayer, AecLayerCategory } from '../types/entities';
import type { LayerStoreSnapshot } from '../stores/LayerStore';
import type { LayerFilter, LayerPropertiesFilter } from '../types/layer-filters';

/** Stable id prefix — must match `enterprise-id-prefixes.ts` notes for smart. */
const SMART_PREFIX = 'lfs_';

/** Fixed-id smart filters (always emitted, even if zero matches). */
export const SMART_FILTER_IDS = {
  visible: `${SMART_PREFIX}visible`,
  locked: `${SMART_PREFIX}locked`,
  frozen: `${SMART_PREFIX}frozen`,
  notPlotted: `${SMART_PREFIX}not_plotted`,
  emptyLayers: `${SMART_PREFIX}empty_layers`,
} as const;

/** Derive the per-category smart filter id. Stable across reloads. */
export function getCategorySmartFilterId(category: AecLayerCategory): string {
  return `${SMART_PREFIX}category_${category}`;
}

/** Quick lookup: is this id a smart filter id? */
export function isSmartFilterId(id: string): boolean {
  return id.startsWith(SMART_PREFIX);
}

/** Display-side icon per smart category. Pure data — no React. */
export function getCategoryIcon(category: AecLayerCategory): string {
  const ICONS: Readonly<Record<AecLayerCategory, string>> = {
    architectural: '🏛',
    structural: '🏗',
    electrical: '⚡',
    mechanical: '⚙',
    plumbing: '🚰',
    fire: '🔥',
    civil: '🛣',
    telecom: '📡',
    interior: '🛋',
    general: '📋',
  };
  return ICONS[category];
}

/**
 * Compute the current smart filter set from a LayerStore snapshot.
 *
 * Result includes the 5 fixed smart filters + 1 per AEC category PRESENT in
 * the scene (categories with zero layers are skipped). The fixed filter names
 * carry i18n keys; the consumer resolves them via `useTranslation`.
 *
 * Pure fn — no side effects. Safe to call on every render.
 */
export function getSmartFilters(snapshot: LayerStoreSnapshot): ReadonlyArray<LayerFilter> {
  const createdAt = new Date(0).toISOString(); // deterministic — smart filters carry epoch
  const filters: LayerFilter[] = [];

  // Fixed (always present).
  filters.push(buildSmart(SMART_FILTER_IDS.visible, 'layerFilters.smart.visible', '👁', {
    combinator: 'AND',
    rules: [{ field: 'visible', operator: 'is', value: true }],
  }, createdAt));

  filters.push(buildSmart(SMART_FILTER_IDS.locked, 'layerFilters.smart.locked', '🔒', {
    combinator: 'AND',
    rules: [{ field: 'locked', operator: 'is', value: true }],
  }, createdAt));

  filters.push(buildSmart(SMART_FILTER_IDS.frozen, 'layerFilters.smart.frozen', '❄', {
    combinator: 'AND',
    rules: [{ field: 'frozen', operator: 'is', value: true }],
  }, createdAt));

  filters.push(buildSmart(SMART_FILTER_IDS.notPlotted, 'layerFilters.smart.notPlotted', '🚫', {
    combinator: 'AND',
    rules: [{ field: 'plottable', operator: 'is', value: false }],
  }, createdAt));

  filters.push(buildSmart(SMART_FILTER_IDS.emptyLayers, 'layerFilters.smart.emptyLayers', '∅', {
    combinator: 'AND',
    // Engine `memberKind=entity` returns true for all current LayerStore layers;
    // the empty-layers UI filters via member-count (consumer-side, since
    // counts are derived from scene state outside the snapshot fields).
    rules: [{ field: 'memberKind', operator: 'has', value: 'entity' }],
  }, createdAt));

  // Per-category (only when present in scene).
  const presentCategories = collectPresentCategories(snapshot.layers);
  for (const category of presentCategories) {
    filters.push(buildSmart(
      getCategorySmartFilterId(category),
      'layerFilters.smart.category',
      getCategoryIcon(category),
      {
        combinator: 'AND',
        rules: [{ field: 'category', operator: 'is', value: category }],
      },
      createdAt,
      category,
    ));
  }

  return filters;
}

// ─── Internals ───────────────────────────────────────────────────────────────

function buildSmart(
  id: string,
  i18nKey: string,
  icon: string,
  rules: LayerPropertiesFilter['rules'],
  createdAt: string,
  categoryInterpolation?: AecLayerCategory,
): LayerPropertiesFilter {
  return {
    id,
    name: categoryInterpolation ? `${i18nKey}::${categoryInterpolation}` : i18nKey,
    icon,
    source: 'system-smart',
    kind: 'properties',
    rules,
    createdAt,
  };
}

function collectPresentCategories(
  layers: ReadonlyArray<SceneLayer>,
): ReadonlyArray<AecLayerCategory> {
  const seen = new Set<AecLayerCategory>();
  for (const layer of layers) {
    const cat = (layer.category ?? 'general') as AecLayerCategory;
    seen.add(cat);
  }
  // Stable order — categories appear in their first-seen scene order.
  const ordered: AecLayerCategory[] = [];
  for (const layer of layers) {
    const cat = (layer.category ?? 'general') as AecLayerCategory;
    if (seen.has(cat)) {
      ordered.push(cat);
      seen.delete(cat);
    }
  }
  return ordered;
}
