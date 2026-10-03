'use client';

/**
 * **Παρόμοιες πωλήσεις** — έως οκτώ συμβόλαια της περιοχής, με σειρά ομοιότητας, και **πόσο διαφέρει το καθένα**
 * από την αγγελία (ADR-889 Φ2).
 *
 * 🏆 Rightmove, SeLoger, Zillow δείχνουν «πωλήσεις κοντά»· κανείς δεν λέει **γιατί** είναι όμοιες. Εδώ κάθε γραμμή
 * φέρει τις διαφορές της (εμβαδόν %, έτος, όροφος) — ο άνθρωπος κρίνει, δεν εμπιστεύεται ένα σκορ.
 *
 * 🔑 **Μήνας, όχι ημέρα · καμία διεύθυνση** — η πηγή δεν τη δημοσιεύει, και το λέμε.
 */

import React from 'react';

import { unitPriceLabel, askingAmountLabel } from '@/components/area-market/area-market-format';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFloorLabel } from '@/hooks/useFloorLabel';
import { formatCalendarMonth, formatNumber } from '@/lib/intl-formatting';
import type { ComparableSale } from '@/lib/market/comparable-sales';
import { MARKET_STAT_MIN_SAMPLE } from '@/lib/market/market-statistics';
import type { ListingMarketContext } from '@/lib/market/listing-market-context';

const NS = 'market-contracts';
const PERCENT = 100;

type ReadyContext = Extract<ListingMarketContext, { kind: 'ready' }>;
type Translate = ReturnType<typeof useTranslation>['t'];

const signed = (value: number): string => formatNumber(value, { signDisplay: 'exceptZero', maximumFractionDigits: 0 });

/** Οι μη μηδενικές διαφορές από την αγγελία, όσες μπορούν να υπολογιστούν. */
function deltas(t: Translate, sale: ComparableSale, target: ReadyContext['target']): readonly string[] {
  const out: string[] = [];
  if (sale.size !== null && target.size !== null) {
    const pct = Math.round((sale.size / target.size - 1) * PERCENT);
    if (pct !== 0) out.push(t(`${NS}:comparables.deltaSize`, { delta: signed(pct) }));
  }
  if (sale.yearBuilt !== null && target.yearBuilt !== null && sale.yearBuilt !== target.yearBuilt) {
    out.push(t(`${NS}:comparables.deltaYears`, { delta: signed(sale.yearBuilt - target.yearBuilt) }));
  }
  if (sale.floor !== null && target.floor !== null && sale.floor !== target.floor) {
    out.push(t(`${NS}:comparables.deltaFloors`, { delta: signed(sale.floor - target.floor) }));
  }
  return out;
}

function SaleFacts({ sale }: { readonly sale: ComparableSale }) {
  const { t } = useTranslation([NS]);
  // ADR-903 — η ΜΙΑ ετικέτα ορόφου (ήταν χειρόγραφη: κάθε υπόγειο «Υπόγειο», όσο βαθύ κι αν ήταν).
  const floorLabel = useFloorLabel();
  const facts = [
    formatCalendarMonth(sale.month),
    sale.size === null ? null : t(`${NS}:comparables.size`, { size: formatNumber(sale.size, { maximumFractionDigits: 0 }) }),
    sale.yearBuilt === null ? null : String(sale.yearBuilt),
    sale.floor === null ? null : floorLabel(sale.floor),
  ].filter((fact): fact is string => fact !== null);
  return <p className="m-0 text-xs text-muted-foreground">{facts.join(' · ')}</p>;
}

function SaleRow({ sale, context }: { readonly sale: ComparableSale; readonly context: ReadyContext }) {
  const { t } = useTranslation([NS, 'common', 'search-results']);
  const differences = deltas(t, sale, context.target);
  return (
    <li className="flex flex-col gap-0.5 border-t border-border py-2 first:border-t-0">
      <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
        <span className="font-semibold tabular-nums text-foreground">{unitPriceLabel(t, 'sale', context.segment, sale.unitPrice)}</span>
        <span className="tabular-nums text-muted-foreground">{askingAmountLabel(t, 'sale', sale.price)}</span>
      </p>
      <SaleFacts sale={sale} />
      {differences.length > 0 && <p className="m-0 text-xs text-muted-foreground">{differences.join(' · ')}</p>}
    </li>
  );
}

export function ListingComparableSales({ context }: { readonly context: ReadyContext }) {
  const { t } = useTranslation([NS]);
  const { comparables } = context;
  if (comparables.kind === 'suppressed') {
    return <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:comparables.suppressed`, { count: comparables.pool, min: MARKET_STAT_MIN_SAMPLE })}</p>;
  }
  const window = comparables.windowMonths === null
    ? t(`${NS}:comparables.windowAll`, { from: context.window.from, to: context.window.to })
    : t(`${NS}:comparables.windowRecent`, { months: comparables.windowMonths });
  return (
    <figure className="m-0 flex flex-col gap-1">
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{t(`${NS}:comparables.title`)}</span>
        <span className="text-xs text-muted-foreground">{t(`${NS}:comparables.note`, { count: comparables.pool, window })}</span>
      </figcaption>
      <ol className="m-0 list-none p-0" aria-label={t(`${NS}:comparables.title`)}>
        {comparables.sales.map((sale, index) => (
          <SaleRow key={`${sale.month}-${sale.unitPrice}-${index}`} sale={sale} context={context} />
        ))}
      </ol>
    </figure>
  );
}
