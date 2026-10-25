/**
 * Το κοινό πλαίσιο των επικυρωτών οικογένειας (ADR-923 §5.2): η οικογένεια, η βιβλιοθήκη
 * ιδιοτήτων όπως είναι **τώρα**, το μητρώο μονάδων και ο συλλέκτης ευρημάτων. Οι επικυρωτές
 * παραλλαγών, πίνακα και κανόνων το μοιράζονται αντί να ξαναχτίζουν τα ίδια σύνολα.
 * @module subapps/catalog/schema/family-validation-context
 */

import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { CatalogFamilyDefinition } from '../types/family';
import { isNumericAttributeType } from '../vocabulary/attribute-types';
import type { IssueCollector } from './catalog-issues';

export interface FamilyValidationContext {
  readonly family: CatalogFamilyDefinition;
  /** Η βιβλιοθήκη ιδιοτήτων του χώρου, ανά id (μόνο μη διαγραμμένες). */
  readonly attributes: ReadonlyMap<string, CatalogAttributeDefinition>;
  /** Τα id των ιδιοτήτων που ανήκουν στην οικογένεια. */
  readonly inFamily: ReadonlySet<string>;
  readonly registry: MeasurementRegistry;
  readonly collector: IssueCollector;
}

/** Η ιδιότητα, **μόνο** αν ανήκει στην οικογένεια και υπάρχει στη βιβλιοθήκη. */
export function familyAttribute(
  context: FamilyValidationContext,
  attributeId: string,
): CatalogAttributeDefinition | undefined {
  return context.inFamily.has(attributeId) ? context.attributes.get(attributeId) : undefined;
}

/**
 * «Ποια οικογένεια μέτρησης έχει αυτή η αριθμητική ιδιότητα;» — `null` για καθαρό αριθμό,
 * `undefined` όταν η ιδιότητα **δεν** είναι αριθμητική (ή δεν υπάρχει).
 */
export function numericDimension(attribute: CatalogAttributeDefinition | undefined): string | null | undefined {
  if (!attribute || !isNumericAttributeType(attribute.type)) return undefined;
  return attribute.type === 'measurement' ? attribute.config.measurementFamilyCode : null;
}

/** Όλοι οι άξονες κάθε σχήματος παραλλαγών της οικογένειας. */
export function allAxisIds(family: CatalogFamilyDefinition): ReadonlySet<string> {
  const axes = new Set<string>();
  for (const scheme of family.variantSchemes) {
    for (const level of scheme.levels) level.axisAttributeIds.forEach((id) => axes.add(id));
  }
  return axes;
}
