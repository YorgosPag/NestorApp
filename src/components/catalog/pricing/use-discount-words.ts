'use client';

/**
 * @fileoverview **Οι λέξεις της έκπτωσης** — ποσοστό, κανόνας, περίοδος, κοινό· ένα σημείο για κελί, επεξεργαστή και περιόδους
 *   (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related condition-matrix.ts (`ruleHeadline`: η ΜΙΑ ανάγνωση του κανόνα) · discount-condition-draft.ts (`pickerOfLastDay`)
 * @module components/catalog/pricing/use-discount-words
 *
 * 🔑 **Αριθμοί με τη γλώσσα του UI** (`formatNumber`: «50,25» στα ελληνικά) — ποτέ `toFixed` που θα έγραφε «50.25».
 * 🔑 **Περίοδος με τελευταία ημέρα συμπεριληπτικά**: το «έως» της μηχανής (ημιανοιχτό) λέγεται ως η ημέρα που **ισχύει
 *    ακόμη** — ίδια μετατροπή με τη φόρμα (`pickerOfLastDay`), αλλιώς ο πίνακας θα έλεγε «έως 1/12» και η φόρμα «30/11».
 */

import { useCallback } from 'react';

import { formatDate, formatNumber } from '@/lib/intl-formatting';
import type { DiscountRule } from '@/lib/pricing/discount-rule';
import type { DiscountConditionDefinition, PriceAudience } from '@/subapps/catalog/types/price-list';
import { pricingPartyKey } from '@/subapps/catalog/pricing/price-audience';
import type { CustomerGroupWire } from '@/subapps/catalog/types/pricing-views';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { ruleHeadline, type DiscountFigure } from './condition-matrix';
import { chainTextOf } from './discount-chain-input';
import { pickerOfLastDay, pickerOfValidFrom } from './discount-condition-draft';
import { AUDIENCE_KIND_KEYS } from './pricing-labels';

const PERCENT_FORMAT: Intl.NumberFormatOptions = { maximumFractionDigits: 2, useGrouping: false };

export const formatDiscountPercent = (value: number): string => formatNumber(value, PERCENT_FORMAT);

export interface DiscountWords {
  readonly formatPercent: (value: number) => string;
  /** «50 + 10 ⇒ −55%» · «3 κλίμακες, −5% … −15%» · «Χωρίς έκπτωση». */
  readonly rule: (rule: DiscountRule) => string;
  /** «1/11/2026 – 30/11/2026» · «Από 1/11/2026» · «Έως 30/11/2026» · «Χωρίς όριο». */
  readonly period: (definition: Pick<DiscountConditionDefinition, 'validFrom' | 'validUntil'>) => string;
  /** Το κοινό με λέξεις: είδος, ή το όνομα της ομάδας / του συνεργάτη. */
  readonly audience: (audience: PriceAudience) => string;
}

/**
 * **Οι λέξεις του σχήματος ποσοστού** ({@link DiscountFigure}) — η ΜΙΑ απόδοση για κελί πίνακα και κανόνα με λέξεις· το
 * πρόσημο ζει εδώ και στα locale, ποτέ σε μηδέν («−0%»).
 */
export function useDiscountFigure(): (figure: DiscountFigure) => string {
  const { t } = useCatalogText();
  return useCallback((figure: DiscountFigure): string => {
    if (figure.kind === 'none') return t('pricing.discounts.rule.none');
    if (figure.kind === 'single') return t('pricing.discounts.figure.single', { percent: formatDiscountPercent(figure.percent) });
    if (figure.lowest <= 0) return t('pricing.discounts.figure.upTo', { highest: formatDiscountPercent(figure.highest) });
    return t('pricing.discounts.figure.range', { lowest: formatDiscountPercent(figure.lowest), highest: formatDiscountPercent(figure.highest) });
  }, [t]);
}

export function useDiscountWords(customerGroups: readonly CustomerGroupWire[], partyNames: Readonly<Record<string, string>>): DiscountWords {
  const { t, text } = useCatalogText();
  const figureText = useDiscountFigure();
  const rule = useCallback((value: DiscountRule): string => {
    const headline = ruleHeadline(value);
    if (headline.kind === 'unreadable') return t('pricing.discounts.rule.unreadable');
    const figure = figureText(headline.figure);
    if (headline.kind === 'tiers') return t('pricing.discounts.rule.tiersHeadline', { count: headline.count, figure });
    if (headline.steps.length < 2 || headline.figure.kind === 'none') return figure;
    return t('pricing.discounts.rule.chainHeadline', { chain: chainTextOf(headline.steps, formatDiscountPercent), figure });
  }, [t, figureText]);
  const period = useCallback(({ validFrom, validUntil }: Pick<DiscountConditionDefinition, 'validFrom' | 'validUntil'>): string => {
    const from = pickerOfValidFrom(validFrom);
    const last = pickerOfLastDay(validUntil);
    if (from && last) return t('pricing.discounts.period.between', { from: formatDate(from), last: formatDate(last) });
    if (from) return t('pricing.discounts.period.from', { from: formatDate(from) });
    if (last) return t('pricing.discounts.period.until', { last: formatDate(last) });
    return t('pricing.discounts.period.always');
  }, [t]);
  const audience = useCallback((value: PriceAudience): string => {
    if (value.kind === 'customerGroup') {
      const group = customerGroups.find((candidate) => candidate.id === value.customerGroupId);
      return group ? text(group.labels, group.code) : t(AUDIENCE_KIND_KEYS.customerGroup);
    }
    if (value.kind === 'partner') return partyNames[pricingPartyKey(value.party)] ?? t('pricing.discounts.members.unnamed');
    return t(AUDIENCE_KIND_KEYS[value.kind]);
  }, [customerGroups, partyNames, t, text]);
  return { formatPercent: formatDiscountPercent, rule, period, audience };
}
