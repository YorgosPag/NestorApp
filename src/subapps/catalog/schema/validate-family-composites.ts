/**
 * Επικύρωση των **σύνθετων ενδείξεων** της οικογένειας (ADR-923 §21.6): κάθε μέρος δείχνει σε ιδιότητα της οικογένειας, με τύπο
 * που έχει μονογραμμική κειμενική μορφή, και η μονάδα προβολής ανήκει στην οικογένεια μέτρησης της ιδιότητας. Χωρίς αυτό, η
 * ένδειξη θα τύπωνε σιωπηλά κενό μέρος για πάντα — το ίδιο κενό που δείχνει μια τιμή που απλώς λείπει.
 * @module subapps/catalog/schema/validate-family-composites
 */

import { hasAnyLocalizedText } from '@/i18n/localized-text';
import { findUnit } from '../measurement/conversion';
import { compositeDisplaysOf, type CompositeDisplay, type CompositeDisplayPart } from '../types/family';
import { isCompositePartType } from '../vocabulary/attribute-types';
import { CATALOG_LIMITS } from '../vocabulary/catalog-limits';
import { reportDuplicates } from './catalog-issues';
import { familyAttribute, type FamilyValidationContext } from './family-validation-context';

function validatePart(context: FamilyValidationContext, part: CompositeDisplayPart, path: string): void {
  const attribute = familyAttribute(context, part.attributeId);
  if (!attribute) {
    context.collector.add('compositePartAttributeUnknown', `${path}.attributeId`);
    return;
  }
  if (!isCompositePartType(attribute.type)) {
    context.collector.add('compositePartTypeUnsupported', `${path}.attributeId`);
    return;
  }
  if (part.displayUnitCode === null) return;
  const family = attribute.type === 'measurement' ? context.registry.get(attribute.config.measurementFamilyCode) : undefined;
  if (!family || !findUnit(family, part.displayUnitCode)) {
    context.collector.add('measurementUnitUnknown', `${path}.displayUnitCode`, { code: part.displayUnitCode });
  }
}

function validateComposite(context: FamilyValidationContext, composite: CompositeDisplay, path: string): void {
  if (!hasAnyLocalizedText(composite.labels)) context.collector.add('labelRequired', `${path}.labels`);
  if (composite.parts.length === 0) context.collector.add('compositePartsRequired', `${path}.parts`);
  if (composite.parts.length > CATALOG_LIMITS.maxCompositeParts) {
    context.collector.add('tooMany', `${path}.parts`, { max: CATALOG_LIMITS.maxCompositeParts });
  }
  composite.parts.forEach((part, index) => validatePart(context, part, `${path}.parts[${index}]`));
}

export function validateFamilyComposites(context: FamilyValidationContext): void {
  const composites = compositeDisplaysOf(context.family);
  if (composites.length > CATALOG_LIMITS.maxCompositeDisplays) {
    context.collector.add('tooMany', 'compositeDisplays', { max: CATALOG_LIMITS.maxCompositeDisplays });
  }
  composites.forEach((composite, index) => validateComposite(context, composite, `compositeDisplays[${index}]`));
  reportDuplicates(context.collector, composites.map((composite) => composite.id), (index) => `compositeDisplays[${index}].id`);
}
