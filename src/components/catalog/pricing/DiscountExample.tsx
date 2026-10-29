'use client';

/**
 * @fileoverview **Το ζωντανό παράδειγμα** — «100,00 € ⇒ −50% ⇒ 50,00 € ⇒ −10% ⇒ 45,00 €» (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related discount-condition-draft.ts (`chainExample` · `tierExamples`: η ΙΔΙΑ μηχανή `applyDiscountSteps`)
 * @module components/catalog/pricing/DiscountExample
 *
 * 🔑 Ο άνθρωπος δεν ελέγχει «50 + 10» στο μυαλό του — **βλέπει** ότι δεν είναι −60%. Κάθε ενδιάμεσο ποσό το δίνει η μηχανή
 *    με τη **μία** στρογγύλευσή της· η οθόνη δεν κάνει αριθμητική.
 */

import React from 'react';

import { formatMinor } from '@/lib/money/money';
import type { DiscountRule } from '@/lib/pricing/discount-rule';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { chainExample, tierExamples, type ChainExample } from './discount-condition-draft';
import { percentOfStep } from './discount-chain-input';
import { formatDiscountPercent } from './use-discount-words';

function Waterfall({ example }: { readonly example: ChainExample }) {
  const { t } = useCatalogText();
  return (
    <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0 text-sm tabular-nums">
      <li>{formatMinor(example.gross)}</li>
      {example.steps.map((step, index) => (
        <li key={`${index}-${step.step}`} className="flex items-center gap-2">
          <span className="text-muted-foreground" aria-hidden>→</span>
          <span className="text-muted-foreground">{t('pricing.discounts.rule.step', { percent: formatDiscountPercent(percentOfStep(step.step)) })}</span>
          <span>{formatMinor(step.net)}</span>
        </li>
      ))}
      <li className="font-semibold">{t('pricing.discounts.example.net', { net: formatMinor(example.net), discount: formatMinor(example.discount) })}</li>
    </ol>
  );
}

function TiersExample({ rule }: { readonly rule: Extract<DiscountRule, { kind: 'tiers' }> }) {
  const { t } = useCatalogText();
  const rows = tierExamples(rule);
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {rows.map((row, index) => (
        <li key={`${index}-${row.min}`} className="flex flex-wrap items-baseline gap-2">
          <span className="min-w-24 text-xs font-medium text-muted-foreground">
            {rule.basis === 'amount'
              ? t('pricing.discounts.example.fromAmount', { min: Number.isInteger(row.min) ? formatMinor(row.min) : t('pricing.discounts.rule.unreadable') })
              : t('pricing.discounts.example.fromQuantity', { min: row.min })}
          </span>
          {row.example ? <Waterfall example={row.example} /> : <span className="text-sm text-muted-foreground">{t('pricing.discounts.rule.unreadable')}</span>}
        </li>
      ))}
    </ul>
  );
}

export function DiscountExample({ rule }: { readonly rule: DiscountRule }) {
  const { t } = useCatalogText();
  const chain = rule.kind === 'chain' ? chainExample(rule.steps) : null;
  return (
    <section className="flex flex-col gap-1.5 rounded-md border bg-muted/30 p-3" aria-live="polite">
      <h4 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('pricing.discounts.example.title')}</h4>
      {rule.kind === 'tiers' ? <TiersExample rule={rule} /> : null}
      {rule.kind === 'chain' && chain ? <Waterfall example={chain} /> : null}
      {rule.kind === 'chain' && !chain ? <p className="m-0 text-sm text-muted-foreground">{t('pricing.discounts.rule.unreadable')}</p> : null}
    </section>
  );
}
