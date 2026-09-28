'use client';

/**
 * **Η εποχή του κτιρίου της αγγελίας στην περιοχή** — «Κτίρια 1960–1984 στην περιοχή Χ: ζητούν … · συμβόλαια …»
 * (ADR-890 §13.Α).
 *
 * 🔑 **Εποχή με εποχή.** Η διάμεσος όλης της περιοχής συγκρίνει μια πολυκατοικία του '70 με νεόδμητα· ο κάδος έτους
 * (`YEAR_BUILT_BUCKETS`, κοινός με τη σελίδα περιοχής και τα συμβόλαια) τα χωρίζει. Κάτω από το κατώφλι: το κείμενο
 * το λέει, κανένας αριθμός. Η απόσταση μόνο όταν **και τα δύο** δημοσιεύονται.
 */

import React from 'react';

import { signedPercentLabel, unitPriceLabel } from '@/components/area-market/area-market-format';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ListingMarketContext } from '@/lib/market/listing-market-context';
import { MARKET_STAT_MIN_SAMPLE, reportedCell, type StatCell } from '@/lib/market/market-statistics';

const NS = 'market-contracts';

type ReadyContext = Extract<ListingMarketContext, { kind: 'ready' }>;

export function ListingYearBuiltFigures({ context }: { readonly context: ReadyContext }) {
  const { t } = useTranslation([NS, 'common']);
  // `?? null`: απάντηση του προηγούμενου σχήματος, ακόμη στο CDN (15′), δεν έχει καθόλου το πεδίο.
  const figures = context.yearBuilt ?? null;
  if (figures === null) return null;
  const valueOf = (cell: StatCell | null): string => {
    const reported = reportedCell(cell);
    return reported === null
      ? t(`${NS}:listing.yearBuiltSuppressed`, { min: MARKET_STAT_MIN_SAMPLE })
      : unitPriceLabel(t, 'sale', context.segment, reported.median);
  };
  return (
    <section aria-label={t(`${NS}:yearBuilt.title`)} className="flex flex-col gap-1 border-t border-border pt-2">
      <p className="m-0 text-sm font-medium text-foreground">
        {t(`${NS}:listing.yearBuiltTitle`, { bucket: t(`${NS}:yearBuilt.bucket.${figures.bucket}`), area: context.area.name })}
      </p>
      <p className="m-0 text-sm text-foreground">
        {figures.asking !== null && t(`${NS}:listing.yearBuiltAsking`, { price: valueOf(figures.asking) })}
        {figures.asking !== null && ' · '}
        {t(`${NS}:listing.yearBuiltContract`, { price: valueOf(figures.contract) })}
      </p>
      {figures.gapPct !== null && (
        <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:listing.yearBuiltGap`, { pct: signedPercentLabel(figures.gapPct) })}</p>
      )}
    </section>
  );
}
