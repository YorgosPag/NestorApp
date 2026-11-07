/**
 * **Η δημόσια εμβέλεια του καταλόγου** (ADR-923 §5.13 Σ9): «Δημόσια ορατά: X από Y — γιατί».
 *
 * 🔑 Κανένας δεύτερος υπολογισμός ορατότητας ανά προϊόν. Το X είναι το **αποτέλεσμα** της μίας κρίσης (τα δημόσια έγγραφα που
 *    έγραψε ο ένας γραφέας). Το «γιατί» ρωτά την **ίδια** `judgeVisibility`, με τον **ίδιο** θεατή της προβολής, μόνο για όλο
 *    τον κατάλογο. Είναι συγκεντρωτικό: ανά SKU απαντά η καρτέλα «Ορατότητα».
 * 🔑 Οι αιτίες είναι διατεταγμένες: η πρώτη είναι η κυρίαρχη.
 *
 * **Layering**: καθαρό, χωρίς ανάγνωση. Πελάτης και διακομιστής. @module subapps/catalog/public/public-reach
 */

import { audienceCovers } from '../pricing/price-audience';
import { judgeVisibility, showsProduct, type StoredVisibilityRule } from '../pricing/visibility';
import type { VisibilityAncestry } from '../types/visibility-rule';
import { PUBLIC_VIEWER } from './project-public-model';
import type { PublicationCondition } from './public-publication-condition';

/** Καταγωγή που δεν ανήκει σε κανένα SKU: την αφορούν μόνο οι κανόνες «όλος ο κατάλογος». */
const CATALOG_WIDE: VisibilityAncestry = { variantId: '', modelIds: [], categoryDepths: {} };

export type PublicReachReason =
  | { readonly kind: 'catalogEmpty' }
  | { readonly kind: 'conditionClosed' }
  | { readonly kind: 'conditionUnknown' }
  | { readonly kind: 'syncing' }
  | { readonly kind: 'noRuleForPublic' }
  | { readonly kind: 'catalogRuleHides' }
  | { readonly kind: 'specificRulesHide'; readonly count: number }
  | { readonly kind: 'noVisibleVariant'; readonly count: number };

export type PublicReachReasonKind = PublicReachReason['kind'];

/** Τα γεγονότα, όπως τα διάβασε ο διακομιστής. */
export interface PublicReachFacts {
  readonly published: number;
  readonly total: number;
  readonly condition: PublicationCondition;
  readonly rules: readonly StoredVisibilityRule[];
  readonly syncing: boolean;
  readonly atMs: number;
}

/** Η απάντηση προς την οθόνη. */
export interface PublicCatalogReach {
  readonly published: number;
  readonly total: number;
  readonly fullPassAtMs: number | null;
  readonly reasons: readonly PublicReachReason[];
}

/** Τι απαντά η κρίση στον ανώνυμο για ολόκληρο τον κατάλογο. */
function catalogWideReason(facts: PublicReachFacts): PublicReachReason | null {
  const verdict = judgeVisibility(facts.rules, CATALOG_WIDE, PUBLIC_VIEWER, facts.atMs);
  if (showsProduct(verdict.visibility)) return null;
  return verdict.ruleId === null ? { kind: 'noRuleForPublic' } : { kind: 'catalogRuleHides' };
}

/** Ειδικότεροι κανόνες (κατηγορία · μοντέλο · SKU) που καλύπτουν τον ανώνυμο και κρύβουν. */
function hidingRuleCount(rules: readonly StoredVisibilityRule[]): number {
  return rules.filter((rule) => rule.subject.kind !== 'catalog' && rule.visibility === 'hidden' && audienceCovers(rule.audience, PUBLIC_VIEWER)).length;
}

function conditionReason(condition: PublicationCondition): PublicReachReason | null {
  if (condition === 'open') return null;
  return condition === 'closed' ? { kind: 'conditionClosed' } : { kind: 'conditionUnknown' };
}

/** Οι αιτίες, η κυρίαρχη πρώτη. Κενή λίστα ⇒ όλα τα προϊόντα φτάνουν στο κοινό. */
export function explainPublicReach(facts: PublicReachFacts): readonly PublicReachReason[] {
  if (facts.total === 0) return [{ kind: 'catalogEmpty' }];
  if (facts.published >= facts.total) return [];
  const hiding = hidingRuleCount(facts.rules);
  const reasons = [
    conditionReason(facts.condition),
    facts.syncing ? { kind: 'syncing' } as const : null,
    catalogWideReason(facts),
    hiding > 0 ? { kind: 'specificRulesHide', count: hiding } as const : null,
  ].filter((reason): reason is PublicReachReason => reason !== null);
  return reasons.length > 0 ? reasons : [{ kind: 'noVisibleVariant', count: facts.total - facts.published }];
}
