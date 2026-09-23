'use client';

/**
 * @fileoverview **«ΠΩΣ ΠΑΕΙ Η ΑΓΓΕΛΙΑ ΜΟΥ»** — ο αναλυτικός πίνακας της λεπτομέρειας (ADR-777 §8.72 Φάση 2).
 * @related lib/listings/listing-stats-view.ts · OwnerPropertyStatsChart.tsx · OwnerPropertyPriceSteps.tsx ·
 *   OwnerPropertyStatsRow.tsx (η συμπαγής εκδοχή της κάρτας)
 * @module components/owner-property/OwnerPropertyStatsPanel
 *
 * Τέσσερις δείκτες (προβολές · επαφές · επαφές / 1.000 προβολές · ημέρες στην αγορά), γράφημα
 * 30 / 90 ημερών και εξέλιξη τιμής. Πρότυπο: idealista «rendimiento del anuncio» + Rightmove
 * «Property Performance Report».
 *
 * 🔑 **Το εύρος οδηγεί ΚΑΙ τους δείκτες**: οι προβολές, οι επαφές και ο λόγος τους μετριούνται στο
 * εύρος του γραφήματος — ο αριθμός πάνω και οι ράβδοι κάτω λένε πάντα το **ίδιο** διάστημα.
 * 🔴 Κανένα fetch εδώ: τα δεδομένα έρχονται από το **ΕΝΑ** fetch της σελίδας.
 */

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay, formatNumber } from '@/lib/intl-formatting';
import { daysOnMarket, shiftMarketDay, windowSum } from '@/lib/listings/listing-stats';
import {
  CONTACT_RATE_MIN_VIEWS,
  LISTING_STATS_RANGES,
  contactRateIn,
  listingPriceEvents,
  listingStatsDays,
  priceEventsIn,
  viewsIn,
  type ContactRate,
  type ListingStatsRange,
  type ViewsReading,
} from '@/lib/listings/listing-stats-view';
import type { ListingStatsState } from '@/hooks/owner-property/useOwnerPortfolioStats';
import type { ListedAt } from '@/types/public-listing';

import { OwnerPropertyPriceSteps } from './OwnerPropertyPriceSteps';
import { StatsChartPending, StatsPanelPending, StatsPanelSkeleton } from './owner-property-stats-pending';

const S = 'property-market:offer.stats';

const OwnerPropertyStatsChart = dynamic(() => import('./OwnerPropertyStatsChart'), {
  ssr: false,
  loading: StatsChartPending,
});

type ReadyStats = Extract<ListingStatsState, { state: 'ready' }>;

const count = (value: number): string => formatNumber(value, { maximumFractionDigits: 0 });

/** Η τιμή και η εξήγηση του λόγου — ο λόγος λέγεται **πάντα** με τον παρονομαστή του. */
function rateView(rate: ContactRate, t: Translate): { readonly value: string; readonly detail: string } {
  if (rate.kind === 'rate') {
    return {
      value: formatNumber(rate.perThousand, { maximumFractionDigits: 1 }),
      detail: t(`${S}.kpi.rateDetail`, { contacts: rate.contacts, views: count(rate.views) }),
    };
  }
  if (rate.kind === 'insufficient') {
    return { value: '—', detail: t(`${S}.kpi.rateInsufficient`, { views: count(rate.views), min: count(CONTACT_RATE_MIN_VIEWS) }) };
  }
  return { value: '—', detail: t(`${S}.unknown`) };
}

/**
 * Οι προβολές του εύρους — ο αριθμός λέει **σε πόσες μετρημένες** ημέρες. Πριν αρχίσει η μέτρηση:
 * παύλα + «Μετράμε από …», ποτέ «0 · Τελευταίες 30 ημέρες» (ADR-777 §8.72.8).
 */
function viewsKpiView(reading: ViewsReading, range: ListingStatsRange, t: Translate): { readonly value: string; readonly detail: string } {
  if (reading.kind === 'unknown') return { value: '—', detail: t(`${S}.unknown`) };
  if (reading.kind === 'not-yet') {
    return { value: '—', detail: t(`${S}.kpi.viewsNotYet`, { date: formatCalendarDay(reading.countingSince) }) };
  }
  const detail = reading.days < range ? t(`${S}.kpi.viewsCounted`, { days: reading.days }) : t(`${S}.kpi.inRange`, { days: range });
  return { value: count(reading.views), detail };
}

/** Ένας δείκτης: όρος · τιμή · (προαιρετικά) λεπτομέρεια. `<dl>` επειδή αυτό είναι. */
function Kpi({ label, value, detail }: { readonly label: string; readonly value: string; readonly detail?: string }): React.ReactElement {
  return (
    <dl className="m-0 flex flex-col gap-1 rounded-md border border-border p-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="m-0 text-2xl font-semibold tabular-nums text-foreground">{value}</dd>
      {detail !== undefined && <dd className="m-0 text-xs text-muted-foreground">{detail}</dd>}
    </dl>
  );
}

function RangeSwitch({ value, onChange }: { readonly value: ListingStatsRange; readonly onChange: (next: ListingStatsRange) => void }): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  // ☑️ ADR-770 §19 — αποκλειστική επιλογή ⇒ `SegmentedControl` (ρόλος χειριστηρίου, radio, βελάκια). Εδώ ζούσε η
  //    ΠΡΩΤΗ χειρόγραφη σύνθεση του ρόλου (§8.72.8 #2)· έγινε το primitive και αυτή η γραμμή το ζητά.
  const onValue = (raw: string) => {
    const next = LISTING_STATS_RANGES.find((range) => String(range) === raw);
    if (next !== undefined) onChange(next);
  };
  return (
    <SegmentedControl value={String(value)} onValueChange={onValue} aria-label={t(`${S}.range.label`)}>
      {LISTING_STATS_RANGES.map((range) => (
        <SegmentedControlItem key={range} value={String(range)}>
          {t(`${S}.range.${range}`)}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

function StatsKpis({ stats, range, listedAt }: { readonly stats: ReadyStats; readonly range: ListingStatsRange; readonly listedAt: ListedAt | undefined }): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const [nowMs] = useState(() => Date.now());
  const { summary, today } = stats;
  const from = shiftMarketDay(today, -(range - 1));
  const inRange = t(`${S}.kpi.inRange`, { days: range });
  const rate = contactRateIn(summary, from, today);
  const days = daysOnMarket(listedAt, nowMs);
  const unknown = t(`${S}.unknown`);

  const rateShown = rateView(rate, t);
  const viewsShown = viewsKpiView(viewsIn(summary, from, today), range, t);

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label={t(`${S}.kpi.views`)} value={viewsShown.value} detail={viewsShown.detail} />
      <Kpi
        label={t(`${S}.kpi.contacts`)}
        value={summary.contacts === null ? '—' : count(windowSum(summary.contacts.daily, from, today))}
        detail={summary.contacts === null ? unknown : inRange}
      />
      <Kpi label={t(`${S}.kpi.rate`)} value={rateShown.value} detail={rateShown.detail} />
      <Kpi
        label={t(`${S}.kpi.days`)}
        value={days === null ? '—' : count(days)}
        detail={days === null ? t(`${S}.kpi.daysUnknown`) : undefined}
      />
    </section>
  );
}

interface ReadyPanelProps {
  readonly stats: ReadyStats;
  readonly listedAt: ListedAt | undefined;
  readonly priceHistory: unknown;
}

function ReadyPanel({ stats, listedAt, priceHistory }: ReadyPanelProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const [range, setRange] = useState<ListingStatsRange>(30);
  const { summary, today } = stats;
  const events = useMemo(() => listingPriceEvents(priceHistory), [priceHistory]);
  const days = useMemo(() => listingStatsDays(summary, today, range), [summary, today, range]);
  const eventsInRange = useMemo(() => priceEventsIn(events, days), [events, days]);

  return (
    <>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-base font-semibold text-foreground">{t(`${S}.heading`)}</h3>
        <RangeSwitch value={range} onChange={setRange} />
      </header>
      <p className="m-0 text-sm text-muted-foreground">
        {t(`${S}.countingSince`, { date: formatCalendarDay(summary.countingSince, true) })} · {t(`${S}.countingSinceWhy`)}
      </p>
      <StatsKpis stats={stats} range={range} listedAt={listedAt} />
      {summary.views === null ? (
        <p className="m-0 text-sm text-muted-foreground">{t(`${S}.unavailable`)}</p>
      ) : (
        <OwnerPropertyStatsChart days={days} events={eventsInRange} />
      )}
      <OwnerPropertyPriceSteps events={events} />
    </>
  );
}

export interface OwnerPropertyStatsPanelProps extends Omit<ReadyPanelProps, 'stats'> {
  readonly stats: ListingStatsState;
}

export function OwnerPropertyStatsPanel({ stats, listedAt, priceHistory }: OwnerPropertyStatsPanelProps): React.ReactElement | null {
  const { t, isNamespaceReady } = useTranslation(['property-market']);

  // ⚠️ Ο διακομιστής δεν θεωρεί αυτή την αγγελία δική σου για στατιστικά ⇒ **κανένα** πλαίσιο.
  if (stats.state === 'absent') return null;

  // 🔴 ADR-744 §14.3 · CHECK 3.51 — πριν γεμίσει το namespace, **καμία** κλήση `t()`, ούτε σε
  //    γνώρισμα: τα κλειδιά του πίνακα ζουν ΠΙΣΩ από όριο `next/dynamic`, άρα δεν είναι στο route
  //    slice· ένα `aria-label={t(…)}` εδώ θα έβγαζε ωμό κλειδί στο HTML του διακομιστή.
  //    Ο φραγμός ζει στο ΦΥΛΛΟ (όχι σε PageContent — CHECK 3.7 `no-navigation-flash`): ο σκελετός
  //    κρατά το ύψος του πλαισίου, άρα δεν υπάρχει μετατόπιση.
  return isNamespaceReady ? (
    <section aria-label={t(`${S}.heading`)} className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
      {stats.state === 'loading' ? (
        // Ο σκελετός έχει τη ΔΟΜΗ του τελικού πίνακα: ένα «Φόρτωση…» μίας γραμμής θα μάζευε το πλαίσιο
        // και θα το ξαναμεγάλωνε — μετρημένο CLS 0,056 στη σελίδα (ADR-777 §8.72.8).
        <>
          <p aria-busy="true" className="sr-only">
            {t(`${S}.loading`)}
          </p>
          <StatsPanelSkeleton />
        </>
      ) : stats.state === 'unavailable' ? (
        <p className="m-0 text-sm text-muted-foreground">{t(`${S}.unavailable`)}</p>
      ) : (
        <ReadyPanel stats={stats} listedAt={listedAt} priceHistory={priceHistory} />
      )}
    </section>
  ) : (
    <StatsPanelPending />
  );
}
