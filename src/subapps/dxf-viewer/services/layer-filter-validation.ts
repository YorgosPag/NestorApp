/**
 * layer-filter-validation.ts — Defensive JSON schema validation for `LayerFilter`
 * (ADR-358 §5.7.bis Q11, Phase 11).
 *
 * Two consumers:
 *   1. `layer-filter-io.ts` import path — untrusted JSON from end user.
 *   2. `layer-filter-persistence.ts` Firestore hydrate — defensive against
 *      manually-edited or schema-skewed docs.
 *
 * Returns a discriminated result so callers can surface field-level errors
 * without throwing. Pre-commit ratchet `layer-filter-engine` restricts
 * `\bvalidateLayerFilterJson\b` to allowlist files.
 */

import type {
  LayerFilter,
  LayerFilterRule,
  LayerFilterRuleSet,
} from '../types/layer-filters';

export type ValidationResult =
  | { readonly ok: true; readonly filter: LayerFilter }
  | { readonly ok: false; readonly error: string };

/**
 * Validate an unknown value as a `LayerFilter`. Returns a discriminated result.
 * Does NOT mutate the input. Strict on missing fields, permissive on extra
 * properties (forward compat).
 */
export function validateLayerFilterJson(value: unknown): ValidationResult {
  if (!isObject(value)) return fail('not an object');

  const idResult = validateString(value.id, 'id');
  if (!idResult.ok) return idResult;
  const nameResult = validateString(value.name, 'name');
  if (!nameResult.ok) return nameResult;
  const sourceResult = validateSource(value.source);
  if (!sourceResult.ok) return sourceResult;
  const createdAtResult = validateString(value.createdAt, 'createdAt');
  if (!createdAtResult.ok) return createdAtResult;

  if (value.kind === 'group') {
    if (!Array.isArray(value.layerIds)) return fail('group.layerIds must be array');
    if (!value.layerIds.every((id) => typeof id === 'string')) return fail('group.layerIds[*] must be string');
    return { ok: true, filter: value as unknown as LayerFilter };
  }
  if (value.kind === 'properties') {
    const rulesResult = validateRuleSet(value.rules);
    if (!rulesResult.ok) return rulesResult;
    return { ok: true, filter: value as unknown as LayerFilter };
  }
  return fail(`unknown kind: ${String(value.kind)}`);
}

/** Bulk validator — returns `{valid, invalid}` partitions. */
export function validateLayerFilterJsonBulk(items: unknown[]): {
  readonly valid: ReadonlyArray<LayerFilter>;
  readonly invalid: ReadonlyArray<{ index: number; error: string }>;
} {
  const valid: LayerFilter[] = [];
  const invalid: { index: number; error: string }[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const result = validateLayerFilterJson(items[i]);
    if (result.ok) valid.push(result.filter);
    else invalid.push({ index: i, error: result.error });
  }
  return { valid, invalid };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(error: string): ValidationResult {
  return { ok: false, error };
}

function validateString(value: unknown, field: string): ValidationResult {
  if (typeof value !== 'string' || value.length === 0) return fail(`${field} must be non-empty string`);
  return { ok: true, filter: undefined as unknown as LayerFilter };
}

const SOURCES = new Set(['user-created', 'system-smart', 'imported']);

function validateSource(value: unknown): ValidationResult {
  if (typeof value !== 'string' || !SOURCES.has(value)) return fail(`source invalid: ${String(value)}`);
  return { ok: true, filter: undefined as unknown as LayerFilter };
}

const VALID_COMBINATORS = new Set(['AND', 'OR']);

function validateRuleSet(value: unknown): ValidationResult {
  if (!isObject(value)) return fail('rules must be object');
  if (!VALID_COMBINATORS.has(value.combinator as string)) return fail('rules.combinator must be AND|OR');
  if (!Array.isArray(value.rules)) return fail('rules.rules must be array');
  for (let i = 0; i < value.rules.length; i += 1) {
    const ruleResult = validateRule(value.rules[i]);
    if (!ruleResult.ok) return fail(`rules.rules[${i}]: ${ruleResult.error}`);
  }
  if (value.nested !== undefined) {
    if (!Array.isArray(value.nested)) return fail('rules.nested must be array');
    for (let i = 0; i < value.nested.length; i += 1) {
      const nestedResult = validateRuleSet(value.nested[i]);
      if (!nestedResult.ok) return fail(`rules.nested[${i}]: ${nestedResult.error}`);
    }
  }
  return { ok: true, filter: undefined as unknown as LayerFilter };
}

const VALID_FIELDS = new Set<LayerFilterRule['field']>([
  'name', 'category', 'tag', 'visible', 'frozen', 'locked', 'plottable',
  'color.aci', 'linetype', 'lineweight', 'memberKind',
]);

function validateRule(value: unknown): ValidationResult {
  if (!isObject(value)) return fail('rule must be object');
  if (!VALID_FIELDS.has(value.field as LayerFilterRule['field'])) return fail(`field invalid: ${String(value.field)}`);
  if (typeof value.operator !== 'string') return fail('operator must be string');
  if (value.value === undefined) return fail('value required');
  // Per-field shape compatibility is enforced at engine level; loose check here
  // suffices for malformed-JSON detection (the engine fail-safes return false
  // for unmatched operator/value combos).
  return { ok: true, filter: undefined as unknown as LayerFilter };
}

// Backward-compat type re-exports for `layer-filter-io.ts`.
export type { LayerFilter, LayerFilterRule, LayerFilterRuleSet };
