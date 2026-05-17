/**
 * layer-filter-engine.ts — Pure-fn evaluator for `LayerFilter` (ADR-358 §5.7.bis Q11, Phase 11).
 *
 * SSoT for layer filter evaluation. NO side effects, NO React, NO store
 * imports — input/output only. Memoization lives at the consumer
 * (`useMemo` / `LayerFiltersStore` cache).
 *
 * Algorithm:
 *   - Group filter → `Set(layerIds) ∩ Set(layers.id)`.
 *   - Properties filter → for each layer, evaluate ruleset:
 *       * `combinator='AND'` → all rules pass AND all nested rulesets pass.
 *       * `combinator='OR'`  → any rule passes OR any nested ruleset passes.
 *       * Short-circuit on first miss (AND) / first hit (OR).
 *
 * Pre-commit ratchet `layer-filter-engine` (Tier 3, ADR-358) restricts
 * `\bapplyLayerFilter\b` to allowlist files.
 */

import type { SceneLayer } from '../types/entities';
import type { LayerStoreSnapshot } from '../stores/LayerStore';
import {
  isLayerGroupFilter,
  isLayerPropertiesFilter,
  type LayerFilter,
  type LayerFilterRule,
  type LayerFilterRuleSet,
} from '../types/layer-filters';

export interface ApplyLayerFilterInput {
  readonly filter: LayerFilter;
  readonly layers: ReadonlyArray<SceneLayer>;
  /** Required for `memberKind` rule evaluation; pass current LayerStore snapshot. */
  readonly snapshot: LayerStoreSnapshot;
}

/**
 * Apply a single `LayerFilter` to a layer list. Pure fn. Returns a new array
 * preserving original order. Empty array if no matches.
 *
 * For `memberKind` rules, `snapshot.layers` is consulted for entity/region
 * membership counts (currently entities only — region membership computed
 * once region store is unified per §5.10).
 */
export function applyLayerFilter(input: ApplyLayerFilterInput): ReadonlyArray<SceneLayer> {
  const { filter, layers } = input;
  if (isLayerGroupFilter(filter)) {
    const wanted = new Set(filter.layerIds);
    return layers.filter((l) => wanted.has(l.id));
  }
  if (isLayerPropertiesFilter(filter)) {
    return layers.filter((l) => evaluateRuleSet(filter.rules, l, input.snapshot));
  }
  return [];
}

/**
 * Compute the matching layer id set for a filter. Convenience wrapper used by
 * `LayerFiltersStore` for its `Map<filterId, Set<layerId>>` cache.
 */
export function getMatchingLayerIds(input: ApplyLayerFilterInput): ReadonlySet<string> {
  const matches = applyLayerFilter(input);
  const ids = new Set<string>();
  for (const layer of matches) ids.add(layer.id);
  return ids;
}

// ─── Ruleset evaluation ──────────────────────────────────────────────────────

function evaluateRuleSet(
  ruleset: LayerFilterRuleSet,
  layer: SceneLayer,
  snapshot: LayerStoreSnapshot,
): boolean {
  const isAnd = ruleset.combinator === 'AND';

  for (const rule of ruleset.rules) {
    const pass = evaluateRule(rule, layer, snapshot);
    if (isAnd && !pass) return false;
    if (!isAnd && pass) return true;
  }

  if (ruleset.nested && ruleset.nested.length > 0) {
    for (const child of ruleset.nested) {
      const pass = evaluateRuleSet(child, layer, snapshot);
      if (isAnd && !pass) return false;
      if (!isAnd && pass) return true;
    }
  }

  // AND with no failure → pass; OR with no success → fail.
  // Empty AND-ruleset (no rules + no nested) is vacuously true; empty OR-ruleset
  // is vacuously false (no positive evidence).
  if (isAnd) return true;
  return false;
}

// ─── Rule dispatch (per-field) ───────────────────────────────────────────────

function evaluateRule(
  rule: LayerFilterRule,
  layer: SceneLayer,
  snapshot: LayerStoreSnapshot,
): boolean {
  switch (rule.field) {
    case 'name':
      return evalName(rule, layer.name);
    case 'category':
      return evalCategory(rule, layer.category ?? 'general');
    case 'tag':
      return evalTag(rule, layer.tags ?? []);
    case 'visible':
      return layer.visible === rule.value;
    case 'frozen':
      return (layer.frozen ?? false) === rule.value;
    case 'locked':
      return layer.locked === rule.value;
    case 'plottable':
      return (layer.plottable ?? true) === rule.value;
    case 'color.aci':
      return evalColorAci(rule, layer.colorAci);
    case 'linetype':
      return evalLinetype(rule, layer.linetype ?? 'Continuous');
    case 'lineweight':
      return evalLineweight(rule, layer.lineweight);
    case 'memberKind':
      return evalMemberKind(rule, layer, snapshot);
  }
}

function evalName(
  rule: Extract<LayerFilterRule, { field: 'name' }>,
  name: string,
): boolean {
  const cs = rule.caseSensitive === true;
  const a = cs ? name : name.toLowerCase();
  const b = cs ? rule.value : rule.value.toLowerCase();
  switch (rule.operator) {
    case 'equals': return a === b;
    case 'contains': return a.includes(b);
    case 'startsWith': return a.startsWith(b);
    case 'endsWith': return a.endsWith(b);
    case 'matches': return safeRegexTest(rule.value, name, cs);
  }
}

function safeRegexTest(pattern: string, input: string, caseSensitive: boolean): boolean {
  try {
    return new RegExp(pattern, caseSensitive ? '' : 'i').test(input);
  } catch {
    // Malformed pattern → fail safe (no match). Validation layer catches the bad
    // pattern at filter creation; this guards runtime against stale persisted bad data.
    return false;
  }
}

function evalCategory(
  rule: Extract<LayerFilterRule, { field: 'category' }>,
  cat: string,
): boolean {
  switch (rule.operator) {
    case 'is': return cat === rule.value;
    case 'isNot': return cat !== rule.value;
    case 'isOneOf':
      return Array.isArray(rule.value) && (rule.value as ReadonlyArray<string>).includes(cat);
  }
}

function evalTag(
  rule: Extract<LayerFilterRule, { field: 'tag' }>,
  tags: ReadonlyArray<string>,
): boolean {
  const tagSet = new Set(tags);
  switch (rule.operator) {
    case 'has':
      return typeof rule.value === 'string' && tagSet.has(rule.value);
    case 'hasAny':
      return Array.isArray(rule.value) && (rule.value as ReadonlyArray<string>).some((v) => tagSet.has(v));
    case 'hasAll':
      return Array.isArray(rule.value) && (rule.value as ReadonlyArray<string>).every((v) => tagSet.has(v));
  }
}

function evalColorAci(
  rule: Extract<LayerFilterRule, { field: 'color.aci' }>,
  aci: number | undefined,
): boolean {
  if (aci === undefined) return false;
  switch (rule.operator) {
    case 'equals': return typeof rule.value === 'number' && aci === rule.value;
    case 'oneOf':
      return Array.isArray(rule.value) && (rule.value as ReadonlyArray<number>).includes(aci);
  }
}

function evalLinetype(
  rule: Extract<LayerFilterRule, { field: 'linetype' }>,
  linetype: string,
): boolean {
  switch (rule.operator) {
    case 'is': return linetype === rule.value;
    case 'isOneOf':
      return Array.isArray(rule.value) && (rule.value as ReadonlyArray<string>).includes(linetype);
  }
}

function evalLineweight(
  rule: Extract<LayerFilterRule, { field: 'lineweight' }>,
  lw: number | undefined,
): boolean {
  if (lw === undefined) return false;
  switch (rule.operator) {
    case 'equals': return typeof rule.value === 'number' && lw === rule.value;
    case 'gte': return typeof rule.value === 'number' && lw >= rule.value;
    case 'lte': return typeof rule.value === 'number' && lw <= rule.value;
    case 'between': {
      if (!Array.isArray(rule.value)) return false;
      const [lo, hi] = rule.value as readonly [number, number];
      return lw >= lo && lw <= hi;
    }
  }
}

function evalMemberKind(
  _rule: Extract<LayerFilterRule, { field: 'memberKind' }>,
  _layer: SceneLayer,
  _snapshot: LayerStoreSnapshot,
): boolean {
  // §5.10 Unified LayerStore: region membership is derivable from
  // `SceneModel.regions.filter(r => r.layerId === layerId)`. Until that
  // derivation is wired through `LayerStoreSnapshot`, we treat all current
  // LayerStore layers as 'entity' members (DXF default). Smart "empty layers"
  // filter handles the empty case via memberCount in `layer-smart-filters.ts`.
  return _rule.value === 'entity';
}
