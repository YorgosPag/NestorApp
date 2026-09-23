'use client';

/**
 * @fileoverview **Η ΓΡΑΜΜΗ ΜΕΤΡΙΚΩΝ ΤΗΣ ΚΑΡΤΑΣ** — «142 προβολές σε 7 ημέρες · +24% · 3 επαφές ·
 * 18 ημέρες στην αγορά · ↓ 8,3%». Πρότυπο idealista «Tus anuncios» / Rightmove «Property Performance».
 * @related ADR-777 §8.72 · lib/listings/listing-stats-view.ts · hooks/owner-property/useOwnerPortfolioStats.ts
 * @module components/owner-property/OwnerPropertyStatsRow
 *
 * 🔴 **Άγνωστο ≠ μηδέν, ανά πηγή** (N.12): βλάβη επαφών ⇒ οι προβολές φαίνονται και οι επαφές
 * λένε «μη διαθέσιμες» — ποτέ «0 επαφές». Όσο φορτώνει, μένει ο χώρος **στο ίδιο ύψος**, ώστε η
 * λίστα να μη χοροπηδά όταν φτάσουν οι αριθμοί.
 *
 * ♿ **Κάθε μετρική = εικονίδιο ΚΑΙ κείμενο** (WCAG 1.4.1): το χρώμα της τάσης είναι βοήθημα,
 * ποτέ ο μόνος φορέας. Το κείμενο φορά χρώμα κειμένου, όχι χρώμα σειράς.
 */

import React, { useState } from 'react';
import { CalendarDays, Eye, Mail, Minus, Sparkles, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';

import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay, formatPercentage } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import { daysOnMarket } from '@/lib/listings/listing-stats';
import {
  cardViewsReading,
  comparableViewTrend,
  type ComparableTrend,
  type ViewsReading,
} from '@/lib/listings/listing-stats-view';
import type { ListingStatsState } from '@/hooks/owner-property/useOwnerPortfolioStats';
import type { ListedAt } from '@/types/public-listing';
import type { PriceReduction } from '@/types/price-history';
import { PriceReductionBadge } from '@/components/search-results/PriceReductionBadge';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { StatsRowPending } from './owner-property-stats-pending';

const S = 'property-market:offer.stats';

const ICON_CLASS = 'size-4 shrink-0';

const TREND_ICON: Readonly<Record<ComparableTrend['kind'], LucideIcon>> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
  new: Sparkles,
  none: Minus,
  partial: Sparkles,
};

/** **Η τάση ως εικονίδιο + πρόταση** — ίδια στην κάρτα και στον πίνακα της λεπτομέρειας. */
export function ListingTrendLabel({ trend }: { readonly trend: ComparableTrend }): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const colors = useSemanticColors();
  const Icon = TREND_ICON[trend.kind];
  const tone = trend.kind === 'up' ? colors.text.success : trend.kind === 'down' ? colors.text.error : 'text-muted-foreground';
  const percent = 'ratio' in trend ? formatPercentage(Math.abs(trend.ratio) * 100, { maximumFractionDigits: 0 }) : '';
  return (
    <span className="inline-flex items-center gap-1 text-foreground">
      <Icon aria-hidden className={cn(ICON_CLASS, tone)} />
      {t(`${S}.trend.${trend.kind}`, { percent })}
    </span>
  );
}

/** Μία μετρική: εικονίδιο (διακοσμητικό) + κείμενο που τα λέει όλα. */
function Metric({ icon: Icon, children }: { readonly icon: LucideIcon; readonly children: React.ReactNode }): React.ReactElement {
  return (
    <li className="inline-flex items-center gap-1.5">
      <Icon aria-hidden className={cn(ICON_CLASS, 'text-muted-foreground')} />
      {children}
    </li>
  );
}

/**
 * «N προβολές σε D ημέρες» με τις **μετρημένες** ημέρες — ποτέ «0 σε 7 ημέρες» όταν μετράμε 2 ή
 * καμία (μετρημένο σε ζωντανή σελίδα πριν την εποχή καταγραφής, ADR-777 §8.72.8).
 */
function viewsText(reading: ViewsReading, t: Translate): string {
  if (reading.kind === 'unknown') return t(`${S}.row.viewsUnknown`);
  if (reading.kind === 'not-yet') return t(`${S}.row.viewsNotYet`, { date: formatCalendarDay(reading.countingSince) });
  return t(`${S}.row.views`, { count: reading.views, days: reading.days });
}

interface ReadyRowProps {
  readonly stats: Extract<ListingStatsState, { state: 'ready' }>;
  readonly listedAt: ListedAt | undefined;
  readonly priceReduction: PriceReduction | null;
}

function ReadyRow({ stats, listedAt, priceReduction }: ReadyRowProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  // ⚠️ Μία ανάγνωση ρολογιού ανά mount (ίδιο συμβόλαιο με το `useFreshReduction`).
  const [nowMs] = useState(() => Date.now());
  const { summary, today } = stats;
  const views = cardViewsReading(summary, today);
  // Πριν αρχίσει η μέτρηση δεν υπάρχει τάση — ούτε καν «νέα μέτρηση».
  const trend = views.kind === 'not-yet' ? null : comparableViewTrend(summary, today);
  const days = daysOnMarket(listedAt, nowMs);

  return (
    <ul aria-label={t(`${S}.row.label`)} className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0 text-sm text-foreground">
      <Metric icon={Eye}>
        {viewsText(views, t)}
      </Metric>
      {trend !== null && (
        <li className="inline-flex">
          <ListingTrendLabel trend={trend} />
        </li>
      )}
      <Metric icon={Mail}>
        {summary.contacts === null ? t(`${S}.row.contactsUnknown`) : t(`${S}.row.contacts`, { count: summary.contacts.total })}
      </Metric>
      {days !== null && <Metric icon={CalendarDays}>{t(`${S}.row.days`, { count: days })}</Metric>}
      {priceReduction !== null && (
        <li className="inline-flex">
          <PriceReductionBadge reduction={priceReduction} />
        </li>
      )}
    </ul>
  );
}

export interface OwnerPropertyStatsRowProps {
  readonly stats: ListingStatsState;
  readonly listedAt: ListedAt | undefined;
  readonly priceReduction: PriceReduction | null;
}

export function OwnerPropertyStatsRow({ stats, listedAt, priceReduction }: OwnerPropertyStatsRowProps): React.ReactElement | null {
  const { t, isNamespaceReady } = useTranslation(['property-market']);

  // ⚠️ Η αγγελία που ο διακομιστής δεν θεωρεί δική σου για στατιστικά: **τίποτα**, όχι μηδενικά.
  if (stats.state === 'absent') return null;

  // 🔴 ADR-744 §14.3 — πριν γεμίσει το namespace, **καμία** κλήση `t()` (τα κλειδιά ζουν πίσω από όριο).
  //    Ο φραγμός ζει στο ΦΥΛΛΟ (όχι σε PageContent — CHECK 3.7 `no-navigation-flash`).
  return isNamespaceReady ? (
    stats.state === 'loading' ? (
      <p aria-busy="true" className="m-0 h-5 text-sm text-muted-foreground">{t(`${S}.loading`)}</p>
    ) : stats.state === 'unavailable' ? (
      <p className="m-0 text-sm text-muted-foreground">{t(`${S}.unavailable`)}</p>
    ) : (
      <ReadyRow stats={stats} listedAt={listedAt} priceReduction={priceReduction} />
    )
  ) : (
    <StatsRowPending />
  );
}
