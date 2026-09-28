'use client';

/**
 * **Η διάμεση τιμή συμβολαίου** — διάμεσος, μεσαίο 50%, πλήθος (ADR-889 Φ2 · ADR-890 Φ2).
 *
 * 🔑 Μία απόδοση για τη σελίδα περιοχής **και** τη σελίδα αγγελίας: η ετικέτα «τιμή συμβολαίου» είναι
 * **υπόσχεση** (ADR-890 §3 — ποτέ «αγοραία αξία»), και δύο αντίγραφα θα την κρατούσαν σε δύο σημεία.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ReportedStatCell } from '@/lib/market/market-statistics';
import { cn } from '@/lib/utils';

const NS = 'market-contracts';

const VALUE_SIZE = { lg: 'text-3xl', md: 'text-2xl' } as const;

interface ContractMedianProps {
  readonly cell: ReportedStatCell;
  /** Ποσό μονάδας → κείμενο με μονάδα. */
  readonly price: (amount: number) => string;
  readonly size: keyof typeof VALUE_SIZE;
}

export function ContractMedian({ cell, price, size }: ContractMedianProps) {
  const { t } = useTranslation([NS]);
  return (
    <>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:card.median`)}</p>
      <p className={cn('m-0 font-semibold tabular-nums text-foreground', VALUE_SIZE[size])}>
        <data value={cell.median}>{price(cell.median)}</data>
      </p>
      <p className="m-0 text-sm text-foreground">{t(`${NS}:card.range`, { low: price(cell.p25), high: price(cell.p75) })}</p>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:card.sample`, { count: cell.n })}</p>
    </>
  );
}
