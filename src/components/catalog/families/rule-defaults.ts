/**
 * @fileoverview **Νέος κανόνας συνέπειας με λογική αφετηρία** — καθαρές συναρτήσεις (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/families/rule-defaults
 *
 * 🔑 Ο νέος κανόνας ξεκινά **από ό,τι έχει ήδη η οικογένεια** (πρώτες αριθμητικές ιδιότητες, πρώτος άξονας), ώστε
 *    συχνά να είναι έγκυρος με το πρώτο κλικ — π.χ. «διάταξη» με τις δύο πρώτες ισχύες, φθίνουσα (H ≥ M).
 * 🔑 Η λίστα ειδών είναι δεμένη στη ρίζα (`Record<ConsistencyRuleKind, …>`): νέο είδος κανόνα ⇒ δεν μεταγλωττίζεται
 *    μέχρι να αποκτήσει αφετηρία εδώ.
 */

import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import type { CatalogFamilyDefinition, ConsistencyRule, ConsistencyRuleKind } from '@/subapps/catalog/types/family';
import { isNumericAttributeType } from '@/subapps/catalog/vocabulary/attribute-types';
import { nextLocalId } from './family-draft';

/** Η σειρά των κουμπιών «νέος κανόνας». */
const RULE_KIND_ORDER: Readonly<Record<ConsistencyRuleKind, number>> = {
  unique: 1,
  orderAcrossAttributes: 2,
  monotonicAlongAxis: 3,
  compare: 4,
};

export const RULE_KINDS: readonly ConsistencyRuleKind[] = (Object.keys(RULE_KIND_ORDER) as ConsistencyRuleKind[])
  .sort((a, b) => RULE_KIND_ORDER[a] - RULE_KIND_ORDER[b]);

/** Όλοι οι άξονες των σχημάτων της οικογένειας, ως εγγραφές. */
export function allSchemeAxes(draft: CatalogFamilyDefinition, inFamily: readonly AttributeRecord[]): AttributeRecord[] {
  const ids = new Set(draft.variantSchemes.flatMap((scheme) => scheme.levels.flatMap((level) => level.axisAttributeIds)));
  return inFamily.filter((attribute) => ids.has(attribute.id));
}

export function newRule(kind: ConsistencyRuleKind, draft: CatalogFamilyDefinition, inFamily: readonly AttributeRecord[]): ConsistencyRule {
  const id = nextLocalId('rule', draft.consistencyRules.map((rule) => rule.id));
  const numeric = inFamily.filter((attribute) => isNumericAttributeType(attribute.type));
  const first = numeric[0]?.id ?? '';
  const severity = 'error' as const;
  switch (kind) {
    case 'unique':
      return { id, kind, severity, attributeId: inFamily[0]?.id ?? '' };
    case 'orderAcrossAttributes':
      return { id, kind, severity, attributeIds: numeric.slice(0, 2).map((attribute) => attribute.id), direction: 'descending', strict: false };
    case 'monotonicAlongAxis':
      return { id, kind, severity: 'warning', attributeId: first, axisAttributeId: allSchemeAxes(draft, inFamily)[0]?.id ?? '', direction: 'ascending', strict: true };
    case 'compare':
      return { id, kind, severity: 'warning', leftAttributeId: first, operator: 'gte', right: { kind: 'attribute', attributeId: numeric[1]?.id ?? first } };
  }
}
