'use client';

/**
 * **Ακαθάριστη απόδοση ενοικίου ανά τμήμα** (ADR-890 §5.4 · §13, Φ3).
 *
 * 🏆 **Δύο εκδοχές δίπλα-δίπλα**: με **ζητούμενη** τιμή πώλησης (ό,τι δημοσιεύει το idealista) και με **τιμή
 * συμβολαίου** 12μήνου (ADR-889) — τη δεύτερη δεν τη δίνει κανένα portal, γιατί κανένα δεν έχει και τις δύο πηγές.
 * Η απόσταση των δύο είναι η απόσταση ζητούμενης ↔ συμβολαίου, ειπωμένη σε γλώσσα επενδυτή.
 *
 * 🔑 **«Ακαθάριστη» σε κάθε αριθμό**, με υποσημείωση για ό,τι δεν αφαιρεί. Κάτω από το κατώφλι: τα πλήθη, ποτέ πηλίκο.
 */

import React from 'react';
import { Card } from '@/components/ui/card';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { MARKET_STAT_MIN_SAMPLE } from '@/lib/market/market-statistics';

import type { YieldView } from './area-market-insight-view';
import { yieldPercentLabel } from './area-market-format';

const NS = 'area-market';
const HEADING_ID = 'area-yield';

function YieldFigures({ view }: { readonly view: YieldView }) {
  const { t } = useTranslation([NS]);
  return (
    <Card asChild className="flex flex-col gap-1 p-4">
      <li>
        <h3 className="m-0 text-base font-semibold text-foreground">{t(`${NS}:segment.${view.segment}`)}</h3>
        {view.asking !== null ? (
          <p className="m-0 text-2xl font-semibold tabular-nums text-foreground">
            {t(`${NS}:yield.asking`, { pct: yieldPercentLabel(view.asking) })}
          </p>
        ) : (
          <p className="m-0 text-sm text-foreground">
            {t(`${NS}:yield.suppressed`, { min: MARKET_STAT_MIN_SAMPLE, sale: view.saleCount, rent: view.rentCount })}
          </p>
        )}
        {view.contract !== null && (
          <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:yield.contract`, { pct: yieldPercentLabel(view.contract) })}</p>
        )}
      </li>
    </Card>
  );
}

export function AreaYieldSection({ views }: { readonly views: readonly YieldView[] }) {
  const { t } = useTranslation([NS]);
  if (views.length === 0) return null;
  return (
    <section aria-labelledby={HEADING_ID} className="flex flex-col gap-3">
      <h2 id={HEADING_ID} className="m-0 text-xl font-semibold text-foreground">{t(`${NS}:yield.title`)}</h2>
      <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
        {views.map((view) => <YieldFigures key={view.segment} view={view} />)}
      </ul>
      <p className="m-0 text-xs text-muted-foreground">{t(`${NS}:yield.note`)}</p>
    </section>
  );
}
