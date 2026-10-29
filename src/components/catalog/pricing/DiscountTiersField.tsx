'use client';

/**
 * @fileoverview **Οι κλίμακες έκπτωσης** — βάση (ποσότητα · ποσό), κατώφλι και αλυσίδα ανά κλίμακα (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related discount-condition-draft.ts (`withTierBasis` · `nextTier`) · DiscountChainField.tsx (η αλυσίδα κάθε κλίμακας)
 * @module components/catalog/pricing/DiscountTiersField
 *
 * 🔑 **Κατώφλι = `NumericField`** (ADR-706): ποσό σε ευρώ στην οθόνη, **λεπτά** στο μοντέλο (`minorFromMajor` — τρίτο
 *    δεκαδικό ⇒ `NaN` ⇒ το λέει η επικύρωση, ποτέ στρογγύλευση)· ποσότητα με τα δεκαδικά της μηχανής.
 * 🔑 Μονοτονία, διπλό κατώφλι, όριο 20 — όλα από την **ίδια** επικύρωση με τον γραφέα, στο πεδίο τους.
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NumericField } from '@/components/ui/numeric-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { majorFromMinor, minorFromMajor } from '@/lib/money/money';
import { DISCOUNT_TIER_BASES, type DiscountRule, type DiscountTier, type DiscountTierBasis } from '@/lib/pricing/discount-rule';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { MAX_DISCOUNT_TIERS } from '@/subapps/catalog/vocabulary/pricing';
import { CatalogField } from '../shared/CatalogFormFields';
import { FieldIssues } from '../shared/CatalogIssues';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { nextTier, withTierBasis } from './discount-condition-draft';
import { DiscountChainField } from './DiscountChainField';
import { TIER_BASIS_KEYS } from './pricing-labels';

type TiersRule = Extract<DiscountRule, { kind: 'tiers' }>;

interface DiscountTiersFieldProps {
  readonly rule: TiersRule;
  readonly onChange: (rule: DiscountRule) => void;
  readonly disabled: boolean;
  readonly issues: readonly CatalogIssue[];
}

const isTierBasis = (value: string): value is DiscountTierBasis => (DISCOUNT_TIER_BASES as readonly string[]).includes(value);

/** Το κατώφλι όπως το βλέπει ο άνθρωπος: ευρώ για ποσό, μονάδες για ποσότητα. */
const shownMin = (min: number, basis: DiscountTierBasis): number => (basis === 'amount' ? majorFromMinor(min) : min);
const storedMin = (value: number, basis: DiscountTierBasis): number => (basis === 'amount' ? minorFromMajor(value) ?? Number.NaN : value);

interface TierRowProps {
  readonly tier: DiscountTier;
  readonly index: number;
  readonly basis: DiscountTierBasis;
  readonly onTier: (tier: DiscountTier) => void;
  readonly onRemove: () => void;
  readonly disabled: boolean;
  readonly issues: readonly CatalogIssue[];
}

function TierRow({ tier, index, basis, onTier, onRemove, disabled, issues }: TierRowProps) {
  const { t } = useCatalogText();
  const path = `rule.tiers[${index}]`;
  return (
    <li className="grid gap-2 rounded-md border p-2 sm:grid-cols-[10rem_1fr_auto] sm:items-start">
      <CatalogField label={t(basis === 'amount' ? 'pricing.discounts.rule.tierFromAmount' : 'pricing.discounts.rule.tierFromQuantity')} issues={issues} path={`${path}.min`}>
        {({ id, describedBy }) => (
          <NumericField id={id} aria-describedby={describedBy} value={shownMin(tier.min, basis)} min={0} step={basis === 'amount' ? 10 : 1}
            disabled={disabled} onValueChange={(value) => onTier({ ...tier, min: storedMin(value, basis) })} />
        )}
      </CatalogField>
      <DiscountChainField steps={tier.steps} onChange={(steps) => onTier({ ...tier, steps })} label={t('pricing.discounts.rule.chainLabel')}
        disabled={disabled} issues={issues} path={`${path}.steps`} />
      <Button type="button" variant="ghost" size="icon" className="sm:mt-6" disabled={disabled} onClick={onRemove}
        aria-label={t('pricing.discounts.rule.removeTier', { number: index + 1 })}>
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
    </li>
  );
}

export function DiscountTiersField({ rule, onChange, disabled, issues }: DiscountTiersFieldProps) {
  const { t } = useCatalogText();
  const withTiers = (tiers: readonly DiscountTier[]) => onChange({ ...rule, tiers });
  return (
    <section className="flex flex-col gap-2">
      <CatalogField label={t('pricing.discounts.rule.basisLabel')} hint={t('pricing.discounts.rule.basisHint')}>
        {({ id, describedBy }) => (
          <Select value={rule.basis} disabled={disabled} onValueChange={(basis) => { if (isTierBasis(basis)) onChange(withTierBasis(rule, basis)); }}>
            <SelectTrigger id={id} aria-describedby={describedBy} className="sm:max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DISCOUNT_TIER_BASES.map((basis) => <SelectItem key={basis} value={basis}>{t(TIER_BASIS_KEYS[basis])}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </CatalogField>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {rule.tiers.map((tier, index) => (
          <TierRow key={index} tier={tier} index={index} basis={rule.basis} disabled={disabled} issues={issues}
            onTier={(next) => withTiers(rule.tiers.map((item, at) => (at === index ? next : item)))}
            onRemove={() => withTiers(rule.tiers.filter((_, at) => at !== index))} />
        ))}
      </ol>
      <FieldIssues issues={issues} path="rule.tiers" exact />
      <Button type="button" variant="outline" size="sm" className="self-start" disabled={disabled || rule.tiers.length >= MAX_DISCOUNT_TIERS}
        onClick={() => withTiers([...rule.tiers, nextTier(rule)])}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />{t('pricing.discounts.rule.addTier')}
      </Button>
    </section>
  );
}
