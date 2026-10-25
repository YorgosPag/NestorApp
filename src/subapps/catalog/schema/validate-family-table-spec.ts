/**
 * Επικύρωση του **πίνακα καταλόγου** της οικογένειας (ADR-923 §21.4.3): οι στήλες
 * έρχονται από ένα σχήμα παραλλαγών που υπάρχει· κάθε γραμμή δείχνει σε ιδιότητα της
 * οικογένειας ή σε άξονα του σχήματος· το φίλτρο άξονα δείχνει σε **επιλογή που υπάρχει**
 * («ΤΙΜΗ € BAC-1-CI» χωρίς επιλογή BAC-1-CI θα τύπωνε σιωπηλά κενή γραμμή).
 * @module subapps/catalog/schema/validate-family-table-spec
 */

import { hasAnyLocalizedText } from '@/i18n/localized-text';
import { findUnit } from '../measurement/conversion';
import type { TableAxisFilter, FamilyTableRow, VariantScheme } from '../types/family';
import { CATALOG_LIMITS } from '../vocabulary/catalog-limits';
import { reportDuplicates } from './catalog-issues';
import { familyAttribute, type FamilyValidationContext } from './family-validation-context';

function schemeAxes(scheme: VariantScheme): ReadonlySet<string> {
  return new Set(scheme.levels.flatMap((level) => level.axisAttributeIds));
}

function axisFilterValid(context: FamilyValidationContext, filter: TableAxisFilter, axes: ReadonlySet<string>): boolean {
  if (!axes.has(filter.axisAttributeId)) return false;
  const axis = familyAttribute(context, filter.axisAttributeId);
  if (!axis || axis.type !== 'select') return false;
  return axis.config.options.some((option) => option.code === filter.optionCode);
}

function validateAttributeRow(
  context: FamilyValidationContext,
  row: Extract<FamilyTableRow, { kind: 'attribute' }>,
  axes: ReadonlySet<string>,
  path: string,
): void {
  const attribute = familyAttribute(context, row.attributeId);
  if (!attribute) {
    context.collector.add('tableRowAttributeUnknown', `${path}.attributeId`);
    return;
  }
  if (row.axisFilter !== null && !axisFilterValid(context, row.axisFilter, axes)) {
    context.collector.add('tableAxisFilterInvalid', `${path}.axisFilter`);
  }
  if (row.displayUnitCode !== null) {
    const family = attribute.type === 'measurement'
      ? context.registry.get(attribute.config.measurementFamilyCode)
      : undefined;
    if (!family || !findUnit(family, row.displayUnitCode)) {
      context.collector.add('measurementUnitUnknown', `${path}.displayUnitCode`, { code: row.displayUnitCode });
    }
  }
}

function validateRow(context: FamilyValidationContext, row: FamilyTableRow, axes: ReadonlySet<string>, path: string): void {
  switch (row.kind) {
    case 'groupHeader':
      if (!hasAnyLocalizedText(row.labels)) context.collector.add('labelRequired', `${path}.labels`);
      return;
    case 'axis':
      if (!axes.has(row.axisAttributeId)) context.collector.add('tableRowAttributeUnknown', `${path}.axisAttributeId`);
      return;
    case 'attribute':
      return validateAttributeRow(context, row, axes, path);
  }
}

export function validateFamilyTableSpec(context: FamilyValidationContext): void {
  const spec = context.family.tableSpec;
  if (spec === null) return;
  const scheme = context.family.variantSchemes.find((candidate) => candidate.code === spec.variantSchemeCode);
  if (!scheme) {
    context.collector.add('tableSchemeUnknown', 'tableSpec.variantSchemeCode');
    return;
  }
  if (spec.rows.length > CATALOG_LIMITS.maxTableSpecRows) {
    context.collector.add('tooMany', 'tableSpec.rows', { max: CATALOG_LIMITS.maxTableSpecRows });
  }
  const axes = schemeAxes(scheme);
  spec.rows.forEach((row, index) => validateRow(context, row, axes, `tableSpec.rows[${index}]`));
  reportDuplicates(context.collector, spec.rows.map((row) => row.id), (index) => `tableSpec.rows[${index}].id`);
}
