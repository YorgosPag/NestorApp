/**
 * ADR-353 SSOT — Array parameter validation.
 *
 * Rules (ADR-353 Q8, Q19):
 * - Hard limit: 5000 total items → severity='error'
 * - Warn limit: 1000 total items → severity='warn'
 * - Zero spacing → severity='error'
 * - ArrayEntity as source → severity='error' (nested arrays forbidden)
 * - Source-type allowlist enforced
 */

import type { ArrayParams, ArrayValidationResult } from './types';
import type { EntityType } from '../../types/entities';

// Source types allowed as array sources (Q19)
const ALLOWED_SOURCE_TYPES: ReadonlySet<EntityType> = new Set<EntityType>([
  'line', 'polyline', 'lwpolyline', 'arc', 'circle', 'ellipse', 'spline',
  'rectangle', 'rect', 'text', 'mtext', 'hatch', 'block', 'dimension', 'leader',
  'point', 'xline', 'ray', 'angle-measurement',
]);

const HARD_LIMIT = 5000;
const WARN_LIMIT = 1000;

function totalCount(params: ArrayParams): number {
  switch (params.kind) {
    case 'rect':  return params.rows * params.cols;
    case 'polar': return params.count;
    case 'path':  return params.count;
  }
}

/**
 * Validate array parameters and source entity types.
 *
 * @param params      - Array params to validate
 * @param sourceTypes - Entity types of the selected source entities
 */
export function validateArrayParams(
  params: ArrayParams,
  sourceTypes: EntityType[],
): ArrayValidationResult {
  // Nested array check
  if ((sourceTypes as string[]).includes('array')) {
    return {
      severity: 'error',
      messageKey: 'array.validation.nestedForbidden',
      totalCount: 0,
    };
  }

  // Source-type allowlist
  for (const t of sourceTypes) {
    if (!ALLOWED_SOURCE_TYPES.has(t)) {
      return {
        severity: 'error',
        messageKey: 'array.validation.sourceTypeNotAllowed',
        totalCount: 0,
      };
    }
  }

  // Kind-specific param checks
  const paramError = validateKindParams(params);
  if (paramError !== null) {
    return { severity: 'error', messageKey: paramError, totalCount: 0 };
  }

  const count = totalCount(params);

  if (count > HARD_LIMIT) {
    return {
      severity: 'error',
      messageKey: 'array.validation.hardLimitExceeded',
      totalCount: count,
    };
  }

  if (count > WARN_LIMIT) {
    return {
      severity: 'warn',
      messageKey: 'array.validation.warnLimitExceeded',
      totalCount: count,
    };
  }

  return { severity: 'ok', messageKey: '', totalCount: count };
}

function validateKindParams(params: ArrayParams): string | null {
  switch (params.kind) {
    case 'rect':
      if (params.rows < 1 || params.cols < 1) return 'array.validation.countMustBePositive';
      if (params.rowSpacing === 0 || params.colSpacing === 0) return 'array.validation.spacingCannotBeZero';
      return null;
    case 'polar':
      if (params.count < 1) return 'array.validation.countMustBePositive';
      if (params.fillAngle === 0) return 'array.validation.fillAngleCannotBeZero';
      return null;
    case 'path':
      if (params.count < 1) return 'array.validation.countMustBePositive';
      if (params.method === 'measure' && (params.spacing ?? 0) === 0) {
        return 'array.validation.spacingCannotBeZero';
      }
      if (!params.pathEntityId) return 'array.validation.pathEntityRequired';
      return null;
  }
}
