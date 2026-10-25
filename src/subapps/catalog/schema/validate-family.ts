/**
 * =============================================================================
 * Η ΕΠΙΚΥΡΩΣΗ ΜΙΑΣ ΟΙΚΟΓΕΝΕΙΑΣ ΠΡΟΪΟΝΤΩΝ — ολόκληρης, απέναντι στη βιβλιοθήκη (ADR-923 §5.2)
 * =============================================================================
 *
 * Η οικογένεια είναι **ένα** έγγραφο και επικυρώνεται **ολόκληρο**: ιδιότητες, παραλλαγές,
 * πίνακας, κανόνες — απέναντι στη βιβλιοθήκη ιδιοτήτων **όπως είναι τη στιγμή της
 * εγγραφής** (ο γραφέας τη διαβάζει μέσα στη συναλλαγή). Η **ίδια** συνάρτηση τρέχει στην
 * οθόνη για άμεση ανάδραση.
 *
 * @module subapps/catalog/schema/validate-family
 */

import { hasAnyLocalizedText } from '@/i18n/localized-text';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { CatalogFamilyDefinition } from '../types/family';
import { CATALOG_LIMITS, isCatalogCode } from '../vocabulary/catalog-limits';
import { IssueCollector, type CatalogIssue } from './catalog-issues';
import { familyAttribute, type FamilyValidationContext } from './family-validation-context';
import { validateFamilyRules } from './validate-family-rules';
import { validateFamilyTableSpec } from './validate-family-table-spec';
import { validateFamilyVariants } from './validate-family-variants';

function validateBindings(context: FamilyValidationContext): void {
  const { family, collector } = context;
  if (family.attributes.length > CATALOG_LIMITS.maxAttributesPerFamily) {
    collector.add('tooMany', 'attributes', { max: CATALOG_LIMITS.maxAttributesPerFamily });
  }
  const seen = new Set<string>();
  family.attributes.forEach((binding, index) => {
    const path = `attributes[${index}].attributeId`;
    if (!context.attributes.has(binding.attributeId)) collector.add('attributeUnknown', path);
    if (seen.has(binding.attributeId)) collector.add('attributeDuplicate', path);
    seen.add(binding.attributeId);
  });
}

function validateLabelAndImage(context: FamilyValidationContext): void {
  const { family, collector } = context;
  if (family.labelAttributeId !== null) {
    const attribute = familyAttribute(context, family.labelAttributeId);
    if (!attribute || attribute.type !== 'text') collector.add('labelAttributeType', 'labelAttributeId');
  }
  if (family.imageAttributeId !== null) {
    const attribute = familyAttribute(context, family.imageAttributeId);
    const isImage = attribute?.type === 'asset' && attribute.config.assetKinds.includes('image');
    if (!isImage) collector.add('imageAttributeType', 'imageAttributeId');
  }
}

export function validateFamily(
  family: CatalogFamilyDefinition,
  attributes: ReadonlyMap<string, CatalogAttributeDefinition>,
  registry: MeasurementRegistry,
): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  if (!isCatalogCode(family.code)) collector.add('invalidCode', 'code');
  if (!hasAnyLocalizedText(family.labels)) collector.add('labelRequired', 'labels');
  const context: FamilyValidationContext = {
    family,
    attributes,
    inFamily: new Set(family.attributes.map((binding) => binding.attributeId)),
    registry,
    collector,
  };
  validateBindings(context);
  validateLabelAndImage(context);
  validateFamilyVariants(context);
  validateFamilyTableSpec(context);
  validateFamilyRules(context);
  return collector.issues;
}
