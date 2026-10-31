'use client';

/**
 * @fileoverview **Τα ονόματα του ίχνους** — το ίχνος του επιλυτή δίνει μόνο id· εδώ γίνονται λίστα, έκδοση, συνθήκη
 *   (ADR-923 §5.11 «3δ» Τμήμα 3).
 * @related use-discount-words.ts (οι ΜΙΕΣ λέξεις κανόνα/περιόδου/κοινού)
 * @module components/catalog/pricing/use-price-analysis-names
 *
 * 🔑 Οι ορισμοί έρχονται από τις **όψεις** που έχει ήδη η σελίδα — καμία νέα ανάγνωση ανά γραμμή ίχνους.
 * 🔑 Id που δεν βρίσκεται στην όψη (σβήστηκε ενδιάμεσα) ⇒ το λέμε, δεν δείχνουμε ποτέ ωμό id.
 */

import { useCallback, useMemo } from 'react';

import { formatDate } from '@/lib/intl-formatting';
import type { PriceListsView } from '@/subapps/catalog/types/pricing-views';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { ALL_GROUPS_ROW } from './condition-matrix';
import { useDiscountWords, type DiscountWords } from './use-discount-words';
import type { DiscountsWorkspace } from './use-discounts-workspace';

export interface AnalysisNames {
  readonly words: DiscountWords;
  readonly list: (priceListId: string) => string;
  /** «Έκδοση 3, από 9/11/2026». */
  readonly version: (versionId: string) => string;
  /** «TOSH-CARR · Χονδρέμπορος · −50% · Από 1/11/2026». */
  readonly condition: (conditionId: string) => string;
}

function useConditionName(workspace: DiscountsWorkspace, words: DiscountWords): (conditionId: string) => string {
  const { t, text } = useCatalogText();
  const groups = workspace.discountGroups.view;
  const conditions = workspace.conditions.view;
  return useCallback((conditionId: string): string => {
    const condition = conditions.find((candidate) => candidate.id === conditionId);
    if (!condition) return t('pricing.analysis.unknownEntry');
    const group = groups.find((candidate) => candidate.id === (condition.discountGroupId ?? ALL_GROUPS_ROW));
    const groupName = group ? text(group.labels, group.code) : t('pricing.discounts.matrix.allGroups');
    return [groupName, words.audience(condition.audience), words.rule(condition.rule), words.period(condition)].join(' · ');
  }, [conditions, groups, t, text, words]);
}

export function useAnalysisNames(workspace: DiscountsWorkspace, lists: PriceListsView | null): AnalysisNames {
  const { t, text } = useCatalogText();
  const words = useDiscountWords(workspace.customerGroups.view, workspace.partyNames);
  const condition = useConditionName(workspace, words);
  const list = useCallback((priceListId: string): string => {
    const found = lists?.lists.find((candidate) => candidate.id === priceListId);
    return found ? text(found.labels, found.code) : t('pricing.analysis.unknownEntry');
  }, [lists, t, text]);
  const version = useCallback((versionId: string): string => {
    const found = lists?.versions.find((candidate) => candidate.id === versionId);
    if (!found) return t('pricing.analysis.unknownEntry');
    return t('pricing.analysis.versionOf', { number: found.number, from: found.validFrom ? formatDate(new Date(found.validFrom)) : '—' });
  }, [lists, t]);
  return useMemo(() => ({ words, list, version, condition }), [words, list, version, condition]);
}
