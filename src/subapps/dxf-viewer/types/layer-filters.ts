/**
 * LayerFilter — type SSoT (ADR-358 §5.7.bis Q11, Phase 11).
 *
 * Three kinds of filter:
 *   - `group`      → manual list of layer ids (id-stable, rename-safe).
 *   - `properties` → rule-based (recursive AND/OR with nested rulesets).
 *   - smart        → derived via `getSmartFilters(snapshot)` (NOT a separate
 *                    runtime kind — smart filters surface as `properties`
 *                    filters with `source: 'system-smart'` and deterministic
 *                    `lfs_*` ids; see `layer-smart-filters.ts`).
 *
 * Persistence (user-created + imported only):
 *   Firestore subcollection `projects/{projectId}/layerFilters/{filterId}`.
 *   Smart filters are NOT persisted — they re-compute from the LayerStore
 *   snapshot on every render.
 *
 * Engine entry point: `applyLayerFilter(...)` in
 * `services/layer-filter-engine.ts`. Pre-commit ratchet `layer-filter-engine`
 * forbids filter logic / smart filter / validation duplication outside the
 * allowlist files in `.ssot-registry.json`.
 */

import type { AecLayerCategory } from './entities';

/**
 * Combinator for a `LayerFilterRuleSet`. AND = short-circuit on first false;
 * OR = short-circuit on first true.
 */
export type LayerFilterCombinator = 'AND' | 'OR';

/**
 * Provenance of a filter — UI surfaces an icon/badge per source.
 * `user-created` = built via UI; `imported` = via JSON import; `system-smart`
 * = derived by `getSmartFilters()` (not persisted).
 */
export type LayerFilterSource = 'user-created' | 'system-smart' | 'imported';

/**
 * Field whose value a rule inspects on a `SceneLayer`. `memberKind` is the
 * only field that consults the LayerStore snapshot (entity vs region membership).
 */
export type LayerFilterRuleField =
  | 'name'
  | 'category'
  | 'tag'
  | 'visible'
  | 'frozen'
  | 'locked'
  | 'plottable'
  | 'color.aci'
  | 'linetype'
  | 'lineweight'
  | 'memberKind';

/**
 * Discriminated rule union. Each variant ties `field` to its compatible
 * `operator` + `value` shape — invalid combos are unreachable at compile time.
 */
export type LayerFilterRule =
  | {
      readonly field: 'name';
      readonly operator: 'matches' | 'startsWith' | 'endsWith' | 'contains' | 'equals';
      readonly value: string;
      readonly caseSensitive?: boolean;
    }
  | {
      readonly field: 'category';
      readonly operator: 'is' | 'isNot' | 'isOneOf';
      readonly value: AecLayerCategory | ReadonlyArray<AecLayerCategory>;
    }
  | {
      readonly field: 'tag';
      readonly operator: 'has' | 'hasAny' | 'hasAll';
      readonly value: string | ReadonlyArray<string>;
    }
  | {
      readonly field: 'visible' | 'frozen' | 'locked' | 'plottable';
      readonly operator: 'is';
      readonly value: boolean;
    }
  | {
      readonly field: 'color.aci';
      readonly operator: 'equals' | 'oneOf';
      readonly value: number | ReadonlyArray<number>;
    }
  | {
      readonly field: 'linetype';
      readonly operator: 'is' | 'isOneOf';
      readonly value: string | ReadonlyArray<string>;
    }
  | {
      readonly field: 'lineweight';
      readonly operator: 'equals' | 'gte' | 'lte' | 'between';
      readonly value: number | readonly [number, number];
    }
  | {
      readonly field: 'memberKind';
      readonly operator: 'has';
      readonly value: 'entity' | 'region';
    };

/**
 * Recursive ruleset — `rules` evaluated under `combinator`, then merged with
 * each nested ruleset's result under the same combinator. AND short-circuits
 * on first miss, OR on first hit.
 */
export interface LayerFilterRuleSet {
  readonly combinator: LayerFilterCombinator;
  readonly rules: ReadonlyArray<LayerFilterRule>;
  readonly nested?: ReadonlyArray<LayerFilterRuleSet>;
}

/** Shared header for every filter (group, properties, smart). */
export interface LayerFilterBase {
  /**
   * `lfg_<UUID>` for group, `lfp_<UUID>` for properties, `lfs_<deterministic>`
   * for smart. Deterministic smart ids enable stable `activeFilters` references
   * across DXF reload.
   */
  readonly id: string;
  readonly name: string;
  readonly icon?: string;
  readonly source: LayerFilterSource;
  /** ISO timestamp. Smart filters carry the snapshot resolve time. */
  readonly createdAt: string;
  /** ISO timestamp of last user edit. Smart filters omit this. */
  readonly updatedAt?: string;
}

export interface LayerGroupFilter extends LayerFilterBase {
  readonly kind: 'group';
  readonly layerIds: ReadonlyArray<string>;
}

export interface LayerPropertiesFilter extends LayerFilterBase {
  readonly kind: 'properties';
  readonly rules: LayerFilterRuleSet;
}

export type LayerFilter = LayerGroupFilter | LayerPropertiesFilter;

// ─── Type guards ─────────────────────────────────────────────────────────────

export function isLayerGroupFilter(value: LayerFilter): value is LayerGroupFilter {
  return value.kind === 'group';
}

export function isLayerPropertiesFilter(
  value: LayerFilter,
): value is LayerPropertiesFilter {
  return value.kind === 'properties';
}

export function isSmartFilter(value: LayerFilter): boolean {
  return value.source === 'system-smart';
}

// ─── Active filter combo (multi-filter intersection/union) ───────────────────

/** One entry in the active filter list. First entry's combinator is identity. */
export interface ActiveLayerFilterEntry {
  readonly filterId: string;
  readonly combinator: LayerFilterCombinator;
}

/** Maximum number of concurrently active filters (UI overflow prevention). */
export const ACTIVE_FILTERS_MAX = 8;
