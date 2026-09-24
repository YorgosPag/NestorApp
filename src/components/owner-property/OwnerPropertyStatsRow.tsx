'use client';

/**
 * @fileoverview **ΤΑ ΠΛΑΚΙΔΙΑ ΜΕΤΡΙΚΩΝ ΤΗΣ ΚΑΡΤΑΣ** — Προβολές · Επαφές · Αποθηκεύσεις · Ημέρες στην αγορά.
 * Πρότυπο Zillow «Views · Saves · Contacts» / idealista «Visitas · Contactos · Favoritos».
 * @related ADR-777 §8.72 · §8.74 · §8.74.7 · owner-property-kpi.tsx · owner-property-stats-pending.tsx
 * @module components/owner-property/OwnerPropertyStatsRow
 *
 * 📐 **ΣΤΑΘΕΡΗ ΓΕΩΜΕΤΡΙΑ, ΟΧΙ ΚΕΙΜΕΝΟ ΠΟΥ ΑΝΑΔΙΠΛΩΝΕΤΑΙ** (§8.74.7). Ήταν μία πρόταση-γραμμή («70 προβολές σε
 * 7 ημέρες · Νέα μέτρηση — … · 3 επαφές · …») που έπιανε 1 έως 3 γραμμές ανάλογα με κείμενο και πλάτος, ενώ ο
 * σκελετός κρατούσε 1 ⇒ CLS μετρημένο σε browser. Τώρα: **ίδιο** πλέγμα, **ίδια** πλακίδια, **ίδιο** ύψος ανά
 * γραμμή για σκελετό, φόρτωση, βλάβη και τιμές. Η πλήρης εξήγηση (τάση σε πρόταση, 30/90) ζει στον πίνακα.
 *
 * 🔴 **Άγνωστο ≠ μηδέν, ανά πηγή** (N.12): βλάβη επαφών ⇒ «—» + «μη διαθέσιμο», ποτέ «0».
 *
 * ♿ Η τάση φαίνεται συμπαγής («+40 %» με βέλος) και **λέγεται** ολόκληρη στον αναγνώστη οθόνης. Το χρώμα
 * είναι στο βέλος, ποτέ ο μόνος φορέας (WCAG 1.4.1).
 */

import React, { useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { formatPercentage } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import { LISTING_STATS_WINDOW_DAYS, daysOnMarket, shiftMarketDay, windowSum } from '@/lib/listings/listing-stats';
import {
  cardViewsReading,
  comparableViewTrend,
  type ComparableTrend,
} from '@/lib/listings/listing-stats-view';
import type { ListingStatsState } from '@/hooks/owner-property/useOwnerPortfolioStats';
import type { ListedAt } from '@/types/public-listing';
import type { PriceReduction } from '@/types/price-history';
import { PriceReductionBadge } from '@/components/search-results/PriceReductionBadge';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { Kpi, STATS_KEYS as S, formatCount, viewsKpiView } from './owner-property-kpi';
import { CARD_KPI_GRID, StatsRowPending } from './owner-property-stats-pending';

/**
 * **Η τάση, συμπαγής** — μόνο όταν υπάρχει **σύγκριση** (πάνω/κάτω). «Νέα μέτρηση», «σταθερές», «πρώτες
 * προβολές» δεν χωρούν σε πλακίδιο χωρίς να κοπούν· τις λέει ολόκληρες ο πίνακας της λεπτομέρειας.
 */
function TrendChip({ trend }: { readonly trend: ComparableTrend | null }): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);
  const colors = useSemanticColors();
  if (trend === null || (trend.kind !== 'up' && trend.kind !== 'down')) return null;
  const Icon = trend.kind === 'up' ? TrendingUp : TrendingDown;
  const signed = formatPercentage(trend.ratio * 100, { maximumFractionDigits: 0, signDisplay: 'exceptZero' });
  const spoken = t(`${S}.trend.${trend.kind}`, {
    percent: formatPercentage(Math.abs(trend.ratio) * 100, { maximumFractionDigits: 0 }),
  });
  return (
    <span className="ms-1.5 inline-flex items-center gap-0.5 text-xs font-medium">
      <Icon aria-hidden className={cn('size-3.5 shrink-0', trend.kind === 'up' ? colors.text.success : colors.text.error)} />
      <span aria-hidden>{signed}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}

interface TilesProps {
  readonly stats: ListingStatsState;
  readonly listedAt: ListedAt | undefined;
  readonly priceReduction: PriceReduction | null;
}

/** Οι ημέρες στην αγορά **δεν** εξαρτώνται από τα στατιστικά: φαίνονται και όταν εκείνα έπεσαν. */
function DaysTile({ listedAt, priceReduction, t }: Omit<TilesProps, 'stats'> & { readonly t: Translate }): React.ReactElement {
  // ⚠️ Μία ανάγνωση ρολογιού ανά mount (ίδιο συμβόλαιο με το `useFreshReduction`).
  const [nowMs] = useState(() => Date.now());
  const days = daysOnMarket(listedAt, nowMs);
  const detail = days === null
    ? t(`${S}.kpi.daysUnknown`)
    : priceReduction !== null && <PriceReductionBadge reduction={priceReduction} className="text-xs" />;
  return <Kpi density="card" label={t(`${S}.kpi.days`)} value={days === null ? '—' : formatCount(days)} detail={detail} />;
}

function ReadyTiles({ stats, t }: { readonly stats: Extract<ListingStatsState, { state: 'ready' }>; readonly t: Translate }): React.ReactElement {
  const { summary, today } = stats;
  const from = shiftMarketDay(today, -(LISTING_STATS_WINDOW_DAYS - 1));
  const views = cardViewsReading(summary, today);
  const viewsShown = viewsKpiView(views, LISTING_STATS_WINDOW_DAYS, t);
  // Πριν αρχίσει η μέτρηση δεν υπάρχει τάση.
  const trend = views.kind === 'not-yet' ? null : comparableViewTrend(summary, today);
  const unknown = t(`${S}.unknown`);
  const inWindow = t(`${S}.kpi.inRange`, { days: LISTING_STATS_WINDOW_DAYS });
  const { contacts, saves } = summary;
  return (
    <>
      <Kpi density="card" label={t(`${S}.kpi.views`)} value={<>{viewsShown.value}<TrendChip trend={trend} /></>} detail={viewsShown.detail} />
      <Kpi density="card" label={t(`${S}.kpi.contacts`)} value={contacts === null ? '—' : formatCount(windowSum(contacts.daily, from, today))} detail={contacts === null ? unknown : inWindow} />
      <Kpi
        density="card"
        label={t(`${S}.kpi.saves`)}
        value={saves === null ? '—' : formatCount(saves.total)}
        detail={saves === null ? unknown : t(`${S}.kpi.savesNew`, { count: windowSum(saves.daily, from, today), days: LISTING_STATS_WINDOW_DAYS })}
      />
    </>
  );
}

/** Βλάβη ή φόρτωση: **τα ίδια** πλακίδια με παύλα — ποτέ «0», ποτέ άλλο ύψος. */
function PlaceholderTiles({ detail, t }: { readonly detail: string; readonly t: Translate }): React.ReactElement {
  return (
    <>
      {(['views', 'contacts', 'saves'] as const).map((metric) => (
        <Kpi key={metric} density="card" label={t(`${S}.kpi.${metric}`)} value="—" detail={detail} />
      ))}
    </>
  );
}

export type OwnerPropertyStatsRowProps = TilesProps;

export function OwnerPropertyStatsRow({ stats, listedAt, priceReduction }: OwnerPropertyStatsRowProps): React.ReactElement | null {
  const { t, isNamespaceReady } = useTranslation(['property-market']);

  // ⚠️ Η αγγελία που ο διακομιστής δεν θεωρεί δική σου για στατιστικά: **τίποτα**, όχι μηδενικά.
  if (stats.state === 'absent') return null;
  // 🔴 ADR-744 §14.3 — ΜΙΑ διαδρομή αναμονής (namespace ή δεδομένα)· πριν γεμίσει το namespace,
  //    **καμία** κλήση `t()` — γι' αυτό το κείμενο αναγνώστη οθόνης μπαίνει μόνο όταν είναι έτοιμο.
  if (!isNamespaceReady || stats.state === 'loading') {
    return (
      <>
        <StatsRowPending />
        {isNamespaceReady && <p aria-busy="true" className="sr-only">{t(`${S}.loading`)}</p>}
      </>
    );
  }

  return (
    <section aria-label={t(`${S}.row.label`)} className={CARD_KPI_GRID}>
      {stats.state === 'unavailable' ? (
        <>
          <PlaceholderTiles detail={t(`${S}.unknown`)} t={t} />
          <p role="status" className="sr-only">{t(`${S}.unavailable`)}</p>
        </>
      ) : (
        <ReadyTiles stats={stats} t={t} />
      )}
      <DaysTile listedAt={listedAt} priceReduction={priceReduction} t={t} />
    </section>
  );
}
