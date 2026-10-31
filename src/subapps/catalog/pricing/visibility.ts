/**
 * =============================================================================
 * Η ΚΡΙΣΗ ΟΡΑΤΟΤΗΤΑΣ (ADR-923 §12 · §5.12 Δ2 · Δ3 · Σ8)
 * =============================================================================
 *
 * Τρέχει τον **ίδιο** επιλογέα με τιμοκαταλόγους και συνθήκες (`selectMostSpecific`), με ειδικότητα
 * `[κοινό, είδος αντικειμένου, βάθος]`: πρώτα το κοινό όπως ορίζει το §12, μετά SKU > μοντέλο > κατηγορία (κοντινότερος
 * πρόγονος) > κατάλογος.
 *
 * 🔑 **Χωρίς κανόνα ⇒ `hidden`** (Δ3). Κρυφό ≡ ανύπαρκτο προς τον τρίτο.
 * 🔑 **Ισοπαλία ⇒ το περιοριστικότερο, με ίχνος** (Σ8): δύο κατηγορίες ίδιου βάθους, ή επαφή και χώρος του ίδιου
 *    θεατή, με διαφορετικές απαντήσεις. Κανόνας που ανοίγει κάτι δεν κερδίζει από τύχη.
 *
 * Καθαρό: καμία ανάγνωση, κοινό για διακομιστή και οθόνη. @module subapps/catalog/pricing/visibility
 */

import { selectMostSpecific, type SelectionCandidate } from '@/lib/pricing/select-condition';
import type { PricingViewer } from '../types/price-list';
import type {
  VisibilityAncestry,
  VisibilityMismatch,
  VisibilityRuleDefinition,
  VisibilitySubject,
  VisibilityVerdict,
} from '../types/visibility-rule';
import {
  DEFAULT_CATALOG_VISIBILITY,
  VISIBILITY_RESTRICTIVENESS,
  VISIBILITY_SUBJECT_SPECIFICITY,
  type CatalogVisibility,
} from '../vocabulary/pricing';
import { audienceCovers, audienceIdentity, audienceSpecificity } from './price-audience';

/** Σταθερό κλειδί αντικειμένου: ίδιο κλειδί ⇔ ίδιο αντικείμενο. */
export function visibilitySubjectKey(subject: VisibilitySubject): string {
  switch (subject.kind) {
    case 'catalog':
      return 'catalog';
    case 'category':
      return `category:${subject.categoryId}`;
    case 'productModel':
      return `productModel:${subject.modelId}`;
    case 'variant':
      return `variant:${subject.variantId}`;
  }
}

/** Ένας κανόνας ανά (αντικείμενο, κοινό): το κλειδί **είναι** η ταυτότητα του εγγράφου (§5.12 Δ1). */
export function visibilityRuleKey(rule: Pick<VisibilityRuleDefinition, 'subject' | 'audience'>): string {
  return `${visibilitySubjectKey(rule.subject)}|${audienceIdentity(rule.audience)}`;
}

/** Το βάθος του αντικειμένου μέσα στην αλυσίδα του SKU· `null` ⇒ δεν το αφορά. */
function subjectDepth(subject: VisibilitySubject, ancestry: VisibilityAncestry): number | null {
  switch (subject.kind) {
    case 'catalog':
      return 0;
    case 'category':
      return ancestry.categoryDepths[subject.categoryId] ?? null;
    case 'productModel': {
      const depth = ancestry.modelIds.indexOf(subject.modelId);
      return depth === -1 ? null : depth;
    }
    case 'variant':
      return subject.variantId === ancestry.variantId ? 0 : null;
  }
}

export interface StoredVisibilityRule extends VisibilityRuleDefinition {
  readonly id: string;
}

function candidateOf(
  rule: StoredVisibilityRule,
  ancestry: VisibilityAncestry,
  viewer: PricingViewer,
): SelectionCandidate<StoredVisibilityRule, VisibilityMismatch> {
  const depth = subjectDepth(rule.subject, ancestry);
  const mismatch: VisibilityMismatch | null =
    depth === null ? 'otherSubject' : audienceCovers(rule.audience, viewer) ? null : 'audienceMismatch';
  return {
    id: rule.id,
    item: rule,
    validity: { fromMs: null, untilMs: null },
    mismatch,
    specificity: [audienceSpecificity(rule.audience), VISIBILITY_SUBJECT_SPECIFICITY[rule.subject.kind], depth ?? 0],
  };
}

function mostRestrictive(rules: readonly StoredVisibilityRule[]): StoredVisibilityRule {
  return rules.reduce((worst, rule) =>
    VISIBILITY_RESTRICTIVENESS[rule.visibility] > VISIBILITY_RESTRICTIVENESS[worst.visibility] ? rule : worst,
  );
}

/** Τι βλέπει ο θεατής για ένα SKU. `atMs`: οι κανόνες δεν έχουν ισχύ, η σημασία του επιλογέα τη ζητά. */
export function judgeVisibility(
  rules: readonly StoredVisibilityRule[],
  ancestry: VisibilityAncestry,
  viewer: PricingViewer,
  atMs: number,
): VisibilityVerdict {
  const selection = selectMostSpecific(rules.map((rule) => candidateOf(rule, ancestry, viewer)), atMs);
  const { trace } = selection;
  if (selection.kind === 'none') return { visibility: DEFAULT_CATALOG_VISIBILITY, ruleId: null, tied: false, trace };
  if (selection.kind === 'selected') return { visibility: selection.winner.visibility, ruleId: selection.winnerId, tied: false, trace };
  const tiedIds = new Set(selection.tiedIds);
  const winner = mostRestrictive(rules.filter((rule) => tiedIds.has(rule.id)));
  return { visibility: winner.visibility, ruleId: winner.id, tied: true, trace };
}

/** Βλέπει ο θεατής το ίδιο το προϊόν; */
export function showsProduct(visibility: CatalogVisibility): boolean {
  return visibility !== 'hidden';
}

/** Δικαιούται ο θεατής την τιμή; */
export function showsPrice(visibility: CatalogVisibility): boolean {
  return visibility === 'visible';
}
