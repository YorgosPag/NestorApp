'use client';

/**
 * **Τιμές συμβολαίων στην περιοχή** — στη σελίδα αγγελίας, κάτω από την τιμή (ADR-889 Φ2 · ADR-890 Φ2).
 *
 * Τι λέει, με αυτή τη σειρά: η διάμεση **τιμή συμβολαίου** του ίδιου τμήματος στην περιοχή (12 μήνες) · η **τιμή
 * ζώνης** · **πού πέφτει η ζητούμενη τιμή** της αγγελίας ανάμεσα στα συμβόλαια · η **εποχή του κτιρίου** (ζητούν ↔
 * συμβόλαια του ίδιου κάδου έτους, ADR-890 §13.Α) · οι **παρόμοιες πωλήσεις** ·
 * σύνδεσμος στη σελίδα της περιοχής · η αναφορά της πηγής κατά CC-BY · η **ζώνη αντικειμενικής αξίας** της θέσης
 * (ADR-889 Φ5, `ListingValueZone`).
 *
 * 🔑 **Ποτέ «αγοραία αξία», ποτέ «εκτίμηση»** (ADR-890 §3): κάθε αριθμός λέει ποια τιμή είναι.
 */

import React from 'react';

import { unitPriceLabel } from '@/components/area-market/area-market-format';
import { ContractMedian } from '@/components/market/ContractMedian';
import { OpenDataAttribution } from '@/components/market/OpenDataAttribution';
import { useListingMarketContext } from '@/hooks/market/useListingMarketContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import { areaMarketHref } from '@/lib/listings/listing-routes';
import type { ListingMarketContext as Context } from '@/lib/market/listing-market-context';
import { SEGMENT_METRIC } from '@/lib/market/market-segments';
import { isReportedStatCell, MARKET_STAT_MIN_SAMPLE } from '@/lib/market/market-statistics';
import { Link } from '@/lib/workspace/navigation';

import { ListingComparableSales } from './ListingComparableSales';
import { ListingValueZone } from './ListingValueZone';
import { ListingYearBuiltFigures } from './ListingYearBuiltFigures';

const NS = 'market-contracts';
const HEADING_ID = 'listing-market-context';

type ReadyContext = Extract<Context, { kind: 'ready' }>;

function AreaFigures({ context }: { readonly context: ReadyContext }) {
  const { t } = useTranslation([NS, 'area-market', 'common']);
  const price = (amount: number): string => unitPriceLabel(t, 'sale', context.segment, amount);
  const { last12, zone, comparables } = context;
  const percentile = comparables.kind === 'ready' ? comparables.askingPercentile : null;
  const percentileKey = SEGMENT_METRIC[context.segment] === 'perUnit' ? 'percentileUnit' : 'percentile';
  return (
    <>
      <p className="m-0 text-xs text-muted-foreground">
        {t(`${NS}:listing.context`, {
          segment: t(`area-market:segment.${context.segment}`),
          area: context.area.name,
          date: formatCalendarDay(context.asOf, true),
        })}
      </p>
      {isReportedStatCell(last12) ? (
        <ContractMedian cell={last12} price={price} size="md" />
      ) : (
        <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:card.suppressed`, { count: last12.n, min: MARKET_STAT_MIN_SAMPLE })}</p>
      )}
      {zone !== null && isReportedStatCell(zone) && (
        <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:card.zone`, { price: price(zone.median) })}</p>
      )}
      {percentile !== null && <p className="m-0 text-sm font-medium text-foreground">{t(`${NS}:listing.${percentileKey}`, { pct: percentile })}</p>}
    </>
  );
}

function Contracts({ context }: { readonly context: Context }) {
  const { t } = useTranslation([NS]);
  if (context.kind === 'no-area') return <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:listing.noArea`)}</p>;
  if (context.kind === 'no-segment') return <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:listing.noSegment`)}</p>;
  return (
    <>
      <AreaFigures context={context} />
      <ListingYearBuiltFigures context={context} />
      <ListingComparableSales context={context} />
      <Link href={areaMarketHref(context.area.id)} className="text-sm font-medium text-foreground underline underline-offset-4">
        {t(`${NS}:listing.seeArea`, { area: context.area.name })}
      </Link>
      <OpenDataAttribution source="transferValues" />
    </>
  );
}

/** Συμβόλαια της περιοχής, και μετά η ζώνη της θέσης (ADR-889 Φ5) — η ζώνη σε **κάθε** κατάσταση των συμβολαίων. */
function Body({ context }: { readonly context: Context }) {
  return (
    <>
      <Contracts context={context} />
      <ListingValueZone context={context} />
    </>
  );
}

export function ListingMarketContext({ listingId }: { readonly listingId: string }) {
  const { t } = useTranslation([NS]);
  const state = useListingMarketContext(listingId);
  return (
    <section aria-labelledby={HEADING_ID} aria-busy={state.kind === 'loading'} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <h2 id={HEADING_ID} className="m-0 text-base font-semibold text-foreground">{t(`${NS}:listing.title`)}</h2>
      {state.kind === 'loading' && <span aria-hidden className="block h-24 animate-pulse rounded bg-muted" />}
      {state.kind === 'unavailable' && <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:listing.unavailable`)}</p>}
      {state.kind === 'ready' && <Body context={state.context} />}
    </section>
  );
}
