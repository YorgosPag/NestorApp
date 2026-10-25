/**
 * Επικύρωση **σχημάτων παραλλαγών** (ADR-923 §5.2 · Akeneo family variants): 1–2 επίπεδα,
 * 1–5 άξονες ανά επίπεδο, άξονας μόνο από επιτρεπτό τύπο και ποτέ ανά γλώσσα/κανάλι
 * (μια παραλλαγή δεν μπορεί να είναι «500L» στα ελληνικά και κάτι άλλο στα αγγλικά), και
 * κάθε ιδιότητα σε **ένα** μόνο επίπεδο (Revit: type **ή** instance, ποτέ και τα δύο).
 * @module subapps/catalog/schema/validate-family-variants
 */

import { hasAnyLocalizedText } from '@/i18n/localized-text';
import type { VariantLevel, VariantScheme } from '../types/family';
import { isAxisAttributeType } from '../vocabulary/attribute-types';
import { CATALOG_LIMITS, isCatalogCode } from '../vocabulary/catalog-limits';
import { reportDuplicates } from './catalog-issues';
import { familyAttribute, type FamilyValidationContext } from './family-validation-context';

function validateAxis(context: FamilyValidationContext, axisId: string, path: string): void {
  const attribute = familyAttribute(context, axisId);
  if (!attribute) {
    context.collector.add('axisNotInFamily', path);
    return;
  }
  if (!isAxisAttributeType(attribute.type)) context.collector.add('axisTypeNotAllowed', path);
  if (attribute.localizable || attribute.scopable) context.collector.add('axisLocalizedOrScoped', path);
}

function validateLevel(
  context: FamilyValidationContext,
  level: VariantLevel,
  path: string,
  placed: Map<string, string>,
): void {
  const axisCount = level.axisAttributeIds.length;
  if (axisCount === 0 || axisCount > CATALOG_LIMITS.maxAxesPerLevel) {
    context.collector.add('axesCount', `${path}.axisAttributeIds`, { max: CATALOG_LIMITS.maxAxesPerLevel });
  }
  level.axisAttributeIds.forEach((id, index) => validateAxis(context, id, `${path}.axisAttributeIds[${index}]`));
  level.attributeIds.forEach((id, index) => {
    if (!familyAttribute(context, id)) context.collector.add('attributeUnknown', `${path}.attributeIds[${index}]`);
  });
  for (const id of [...level.axisAttributeIds, ...level.attributeIds]) {
    const previous = placed.get(id);
    if (previous !== undefined) context.collector.add('attributeInMultipleLevels', path, { first: previous });
    else placed.set(id, path);
  }
}

function validateScheme(context: FamilyValidationContext, scheme: VariantScheme, path: string): void {
  if (!isCatalogCode(scheme.code)) context.collector.add('invalidCode', `${path}.code`);
  if (!hasAnyLocalizedText(scheme.labels)) context.collector.add('labelRequired', `${path}.labels`);
  const levelCount = scheme.levels.length;
  if (levelCount === 0 || levelCount > CATALOG_LIMITS.maxVariantLevels) {
    context.collector.add('variantLevelsCount', `${path}.levels`, { max: CATALOG_LIMITS.maxVariantLevels });
  }
  const placed = new Map<string, string>();
  scheme.levels.forEach((level, index) => validateLevel(context, level, `${path}.levels[${index}]`, placed));
}

export function validateFamilyVariants(context: FamilyValidationContext): void {
  const { variantSchemes } = context.family;
  if (variantSchemes.length > CATALOG_LIMITS.maxVariantSchemes) {
    context.collector.add('tooMany', 'variantSchemes', { max: CATALOG_LIMITS.maxVariantSchemes });
  }
  variantSchemes.forEach((scheme, index) => validateScheme(context, scheme, `variantSchemes[${index}]`));
  reportDuplicates(
    context.collector,
    variantSchemes.map((scheme) => scheme.code),
    (index) => `variantSchemes[${index}].code`,
  );
}
