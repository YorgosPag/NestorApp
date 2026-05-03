/**
 * @related ADR-186 §8 Q4 + Q7 — PlotType frontage sync + hybrid validation
 *
 * Pure validator for ProjectBuildingCodePhase2. Returns separate errors and
 * warnings arrays so the form can hard-block on errors and surface advisory
 * warnings independently. i18n keys only — no string literals.
 */
import type {
  BuildingCodeValidationResult,
  ProjectBuildingCodePhase2,
  ValidationIssue,
} from '@/types/project-building-code';
import type { PlotType } from '@/services/building-code/types/site.types';
import {
  PHASE2_VALIDATION_LIMITS,
  type NumericLimits,
} from '@/services/building-code/constants/validation.constants';

/**
 * Default frontage count expected for each PlotType.
 * `custom` returns null — no expected count, user-driven.
 */
export function expectedFrontagesForPlotType(type: PlotType): number | null {
  switch (type) {
    case 'mesaio':
      return 1;
    case 'goniako':
    case 'diamperes':
      return 2;
    case 'disgoniaio':
      return 3;
    case 'four_sided':
      return 4;
    case 'custom':
      return null;
  }
}

function checkNumeric(
  field: ValidationIssue['field'],
  value: number,
  limits: NumericLimits,
  i18nPrefix: string,
  out: { errors: ValidationIssue[]; warnings: ValidationIssue[] },
): void {
  if (!Number.isFinite(value) || value < limits.hardMin) {
    out.errors.push({
      field,
      severity: 'error',
      i18nKey: `${i18nPrefix}.hardMin`,
      threshold: `${field}<${limits.hardMin}`,
    });
    return;
  }
  if (value > limits.hardMax) {
    out.errors.push({
      field,
      severity: 'error',
      i18nKey: `${i18nPrefix}.hardMax`,
      threshold: `${field}>${limits.hardMax}`,
    });
    return;
  }
  if (value > limits.softMax) {
    out.warnings.push({
      field,
      severity: 'warning',
      i18nKey: `${i18nPrefix}.softMax`,
      threshold: `${field}>${limits.softMax}`,
    });
  } else if (value < limits.softMin) {
    out.warnings.push({
      field,
      severity: 'warning',
      i18nKey: `${i18nPrefix}.softMin`,
      threshold: `${field}<${limits.softMin}`,
    });
  }
}

function checkFrontages(
  data: ProjectBuildingCodePhase2,
  out: { errors: ValidationIssue[]; warnings: ValidationIssue[] },
): void {
  const limits = PHASE2_VALIDATION_LIMITS.frontagesCount;
  const value = data.frontagesCount;
  if (!Number.isInteger(value) || value < limits.hardMin || value > limits.hardMax) {
    out.errors.push({
      field: 'frontagesCount',
      severity: 'error',
      i18nKey: 'validation.frontages.hard',
      threshold: `count∉[${limits.hardMin},${limits.hardMax}]`,
    });
    return;
  }
  const expected = expectedFrontagesForPlotType(data.plotType);
  if (expected !== null && expected !== value) {
    out.warnings.push({
      field: 'frontagesCount',
      severity: 'warning',
      i18nKey: 'validation.frontages.mismatch',
      threshold: `expected=${expected},actual=${value}`,
    });
  }
}

/**
 * Validate a candidate ProjectBuildingCodePhase2 payload.
 * Pure function — no side effects, safe for both client form and server guard.
 */
export function validateBuildingCodePhase2(
  data: ProjectBuildingCodePhase2,
): BuildingCodeValidationResult {
  const out = { errors: [] as ValidationIssue[], warnings: [] as ValidationIssue[] };
  checkNumeric('sd', data.sd, PHASE2_VALIDATION_LIMITS.sd, 'validation.sd', out);
  checkNumeric(
    'coveragePct',
    data.coveragePct,
    PHASE2_VALIDATION_LIMITS.coveragePct,
    'validation.coverage',
    out,
  );
  checkNumeric(
    'maxHeight',
    data.maxHeight,
    PHASE2_VALIDATION_LIMITS.maxHeight,
    'validation.maxHeight',
    out,
  );
  checkFrontages(data, out);
  return { errors: out.errors, warnings: out.warnings };
}
