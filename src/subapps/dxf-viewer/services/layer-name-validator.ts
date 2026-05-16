/**
 * @file Layer Name Validator — SSoT (ADR-358 §5.6 Q9 — Strict AutoCAD parity)
 *
 * Pure validation function for `SceneLayer.name`. Enforces 7 rules + Layer "0"
 * system-reserved hardening. Zero side effects, deterministic.
 *
 * Consumers (defense in depth, ADR §5.6 line 994-998):
 *   1. UI rename inputs (real-time onChange) — Phase 9G
 *   2. LayerOperationsService.createLayer / .renameLayer — Phase 9B trust boundary
 *   3. DXF parser fallback (when group 2 name violates rules) — Phase 9C
 *
 * Pre-commit ratchet `layer-name-strict-validation` in `.ssot-registry.json`
 * keeps this the only `validateLayerName` implementation in the codebase.
 */

import type { SceneLayer } from '../types/entities';

const MAX_NAME_LENGTH = 255;
const RESERVED_LAYER_NAME = '0' as const;

// ADR §5.6 line 985 — AutoCAD-compatible invalid char set.
const INVALID_CHARS_REGEX = /[<>/\\":;?*|,=`']/;
const INVALID_CHARS_REPLACE_REGEX = /[<>/\\":;?*|,=`']/g;

export type LayerNameValidationError =
  | 'EMPTY'
  | 'WHITESPACE_ONLY'
  | 'LEADING_TRAILING_WS'
  | 'TOO_LONG'
  | 'INVALID_CHARS'
  | 'RESERVED'
  | 'DUPLICATE';

export interface LayerNameValidationResult {
  readonly valid: boolean;
  readonly error: LayerNameValidationError | null;
  /** Suggested safe replacement (when computable). */
  readonly suggestion?: string;
}

export interface ValidateLayerNameInput {
  /** Candidate name (raw, no preprocessing). */
  readonly name: string;
  /** Project-wide layers — provides siblings + Layer "0" identity. */
  readonly existingLayers: ReadonlyArray<SceneLayer>;
  /**
   * Layer id under rename (excluded from duplicate check + identifies
   * "renaming Layer 0" attempt for RESERVED rule). Omit for create.
   */
  readonly excludeId?: string;
}

const OK: LayerNameValidationResult = Object.freeze({ valid: true, error: null });

function fail(
  error: LayerNameValidationError,
  suggestion?: string,
): LayerNameValidationResult {
  return Object.freeze({ valid: false, error, suggestion });
}

/**
 * Validate a candidate layer name against AutoCAD-strict rules.
 * Rule order is fail-fast: cheap/structural checks first, sibling-aware last.
 *
 * Precedence (when multiple violations exist):
 *   EMPTY → WHITESPACE_ONLY → LEADING_TRAILING_WS → TOO_LONG
 *     → INVALID_CHARS → RESERVED → DUPLICATE
 */
export function validateLayerName(
  input: ValidateLayerNameInput,
): LayerNameValidationResult {
  const { name, existingLayers, excludeId } = input;

  if (name.length === 0) return fail('EMPTY');
  if (name.trim().length === 0) return fail('WHITESPACE_ONLY');

  const trimmed = name.trim();
  if (trimmed !== name) return fail('LEADING_TRAILING_WS', trimmed);

  if (name.length > MAX_NAME_LENGTH) {
    return fail('TOO_LONG', name.slice(0, MAX_NAME_LENGTH));
  }

  if (INVALID_CHARS_REGEX.test(name)) {
    const stripped = name.replace(INVALID_CHARS_REPLACE_REGEX, '');
    return fail('INVALID_CHARS', stripped.length > 0 ? stripped : undefined);
  }

  const reservedResult = checkReservedLayer0(name, existingLayers, excludeId);
  if (reservedResult) return reservedResult;

  const lower = name.toLowerCase();
  const duplicate = existingLayers.some(
    (l) => l.name.toLowerCase() === lower && l.id !== excludeId,
  );
  if (duplicate) {
    return fail('DUPLICATE', nextAvailableName(name, existingLayers));
  }

  return OK;
}

/**
 * Layer "0" immutability (ADR §5.6 line 987-991 + §5.6 line 1000-1005):
 *  - Renaming Layer "0" away from "0" → RESERVED (DXF spec immutability).
 *  - Creating or renaming any OTHER layer into name "0" → RESERVED.
 *  - No-op rename Layer "0" → "0" stays valid (idempotency).
 */
function checkReservedLayer0(
  name: string,
  existingLayers: ReadonlyArray<SceneLayer>,
  excludeId: string | undefined,
): LayerNameValidationResult | null {
  const layer0 = existingLayers.find((l) => l.name === RESERVED_LAYER_NAME);
  const isRenamingLayer0 =
    excludeId !== undefined && layer0 !== undefined && layer0.id === excludeId;

  if (isRenamingLayer0 && name !== RESERVED_LAYER_NAME) return fail('RESERVED');
  if (name === RESERVED_LAYER_NAME && !isRenamingLayer0) return fail('RESERVED');
  return null;
}

/**
 * Generate `<base> (n)` suggestion for duplicate names. Increments `n`
 * until an unused slot is found (case-insensitive scan).
 */
function nextAvailableName(
  base: string,
  existingLayers: ReadonlyArray<SceneLayer>,
): string {
  const usedLowerNames = new Set(existingLayers.map((l) => l.name.toLowerCase()));
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base} (${n})`;
    if (!usedLowerNames.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} (${Date.now()})`;
}
