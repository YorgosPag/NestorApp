'use client';

/**
 * @fileoverview **Ο κανόνας της συνθήκης** — αλυσίδα **ή** κλίμακες, με το ζωντανό παράδειγμα (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related DiscountChainField.tsx · DiscountTiersField.tsx · DiscountExample.tsx · discount-condition-draft.ts (`withRuleKind`)
 * @module components/catalog/pricing/DiscountRuleField
 *
 * 🔑 Η εναλλαγή είδους **δεν χάνει** ό,τι γράφτηκε: η αλυσίδα γίνεται η πρώτη κλίμακα και αντίστροφα (`withRuleKind`).
 */

import React from 'react';

import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { DISCOUNT_RULE_KINDS, type DiscountRule } from '@/lib/pricing/discount-rule';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { withRuleKind } from './discount-condition-draft';
import { DiscountChainField } from './DiscountChainField';
import { DiscountExample } from './DiscountExample';
import { DiscountTiersField } from './DiscountTiersField';
import { DISCOUNT_RULE_KIND_ICONS, DISCOUNT_RULE_KIND_KEYS } from './pricing-labels';

interface DiscountRuleFieldProps {
  readonly rule: DiscountRule;
  readonly onChange: (rule: DiscountRule) => void;
  readonly disabled: boolean;
  readonly issues: readonly CatalogIssue[];
}

export function DiscountRuleField({ rule, onChange, disabled, issues }: DiscountRuleFieldProps) {
  const { t } = useCatalogText();
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0" disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium">{t('pricing.discounts.rule.label')}</legend>
      <SegmentedControl value={rule.kind} onValueChange={(kind) => onChange(withRuleKind(rule, kind))} aria-label={t('pricing.discounts.rule.label')}>
        {DISCOUNT_RULE_KINDS.map((kind) => {
          const Icon = DISCOUNT_RULE_KIND_ICONS[kind];
          return <SegmentedControlItem key={kind} value={kind}><Icon className="mr-1 h-4 w-4" aria-hidden />{t(DISCOUNT_RULE_KIND_KEYS[kind])}</SegmentedControlItem>;
        })}
      </SegmentedControl>
      {rule.kind === 'chain' ? (
        <DiscountChainField steps={rule.steps} onChange={(steps) => onChange({ kind: 'chain', steps })} label={t('pricing.discounts.rule.chainLabel')}
          hint={t('pricing.discounts.rule.chainHint')} disabled={disabled} issues={issues} path="rule.steps" />
      ) : (
        <DiscountTiersField rule={rule} onChange={onChange} disabled={disabled} issues={issues} />
      )}
      <DiscountExample rule={rule} />
    </fieldset>
  );
}
