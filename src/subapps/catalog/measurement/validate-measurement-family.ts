/**
 * Η **σημασιολογική** επικύρωση μιας οικογένειας μέτρησης (ADR-923 §5.2) — ό,τι δεν
 * εκφράζει το zod schema: πρότυπο που υπάρχει και είναι ταυτότητα, πεπερασμένοι
 * συντελεστές, μοναδικοί κωδικοί, λογαριθμικό μέγεθος με μία μονάδα, μη σύγκρουση με
 * κωδικό πλατφόρμας. Η **ίδια** συνάρτηση τρέχει στην οθόνη και στον γραφέα, και
 * **επίσης** πάνω στη βιβλιοθήκη της πλατφόρμας (tests) — ένας κανόνας για όλες.
 * @module subapps/catalog/measurement/validate-measurement-family
 */

import { CATALOG_LIMITS, isCatalogCode, MEASUREMENT_UNIT_CODE_PATTERN } from '../vocabulary/catalog-limits';
import { IssueCollector, reportDuplicates, type CatalogIssue } from '../schema/catalog-issues';
import type { MeasurementFamilyDefinition, MeasurementUnitDefinition } from '../types/measurement-family';
import { PLATFORM_MEASUREMENT_FAMILY_CODES } from './platform-families';

function validateUnit(collector: IssueCollector, unit: MeasurementUnitDefinition, index: number): void {
  const path = `units[${index}]`;
  if (!MEASUREMENT_UNIT_CODE_PATTERN.test(unit.code)) collector.add('invalidCode', `${path}.code`);
  if (unit.symbol.trim().length === 0) collector.add('labelRequired', `${path}.symbol`);
  if (!Number.isFinite(unit.factor) || unit.factor <= 0) collector.add('unitInvalidFactor', `${path}.factor`);
  if (unit.offset !== undefined && !Number.isFinite(unit.offset)) collector.add('unitInvalidOffset', `${path}.offset`);
}

function validateStandardUnit(collector: IssueCollector, family: MeasurementFamilyDefinition): void {
  const standardIndex = family.units.findIndex((unit) => unit.code === family.standardUnitCode);
  if (standardIndex === -1) {
    collector.add('unitStandardMissing', 'standardUnitCode');
    return;
  }
  const standard = family.units[standardIndex];
  if (standard.factor !== 1 || (standard.offset ?? 0) !== 0) {
    collector.add('unitStandardNotIdentity', `units[${standardIndex}]`);
  }
}

export interface MeasurementFamilyValidationOptions {
  /** `true` όταν επικυρώνεται οικογένεια **χώρου** — τότε οι κωδικοί πλατφόρμας απαγορεύονται. */
  readonly forbidPlatformCodes: boolean;
}

export function validateMeasurementFamily(
  family: MeasurementFamilyDefinition,
  options: MeasurementFamilyValidationOptions,
): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  if (!isCatalogCode(family.code)) collector.add('invalidCode', 'code');
  if (options.forbidPlatformCodes && PLATFORM_MEASUREMENT_FAMILY_CODES.has(family.code)) {
    collector.add('reservedPlatformCode', 'code', { code: family.code });
  }
  if (family.units.length === 0 || family.units.length > CATALOG_LIMITS.maxUnitsPerMeasurementFamily) {
    collector.add('tooMany', 'units', { max: CATALOG_LIMITS.maxUnitsPerMeasurementFamily });
  }
  family.units.forEach((unit, index) => validateUnit(collector, unit, index));
  reportDuplicates(collector, family.units.map((unit) => unit.code), (index) => `units[${index}].code`);
  validateStandardUnit(collector, family);
  if (family.singleUnit && family.units.length !== 1) collector.add('unitSingleUnitViolated', 'units');
  return collector.issues;
}
