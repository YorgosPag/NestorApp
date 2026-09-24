/**
 * @fileoverview **ΕΝΑΣ ΔΕΙΚΤΗΣ, ΔΥΟ ΠΥΚΝΟΤΗΤΕΣ** — όρος · τιμή · λεπτομέρεια, για τον πίνακα **και** την κάρτα
 * (ADR-777 §8.72 · §8.74.7).
 * @related OwnerPropertyStatsPanel.tsx · OwnerPropertyStatsRow.tsx · owner-property-stats-pending.tsx
 * @module components/owner-property/owner-property-kpi
 *
 * 🔑 **Γιατί εδώ και όχι μέσα στον πίνακα.** Η κάρτα έγινε πλακίδια (§8.74.7) — δηλαδή **ο ίδιος δείκτης**, σε
 * μικρότερη πυκνότητα. Δεύτερο component «μικρός δείκτης» θα ήταν δεύτερη αλήθεια για το «πώς λέγεται μια
 * μέτρηση» (π.χ. «—» + «μη διαθέσιμο», ποτέ «0»), και θα απέκλινε στην πρώτη αλλαγή. Εδώ ζει και η ανάγνωση
 * των προβολών, που την ήθελαν ήδη **και** οι δύο.
 *
 * ⚠️ Η γεωμετρία της πυκνότητας `card` είναι **σταθερές** του σκελετού (`CARD_KPI_*`): το ίδιο ύψος ανά γραμμή
 * είτε φορτώνει είτε όχι — αυτό είναι όλο το CLS 0.
 */

import React from 'react';

import type { Translate } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay, formatNumber } from '@/lib/intl-formatting';
import type { ViewsReading } from '@/lib/listings/listing-stats-view';
import { cn } from '@/lib/utils';

import { CARD_KPI_LINE, CARD_KPI_TILE } from './owner-property-stats-pending';

export const STATS_KEYS = 'property-market:offer.stats';

/** Ακέραιο πλήθος στη γλώσσα του ανθρώπου. */
export const formatCount = (value: number): string => formatNumber(value, { maximumFractionDigits: 0 });

export interface KpiShown {
  readonly value: string;
  readonly detail: string;
}

/**
 * Οι προβολές ενός παραθύρου `windowDays` — ο αριθμός λέει **σε πόσες μετρημένες** ημέρες. Πριν αρχίσει η
 * μέτρηση: παύλα + «Μετράμε από …», ποτέ «0 · Τελευταίες N ημέρες» (ADR-777 §8.72.8).
 */
export function viewsKpiView(reading: ViewsReading, windowDays: number, t: Translate): KpiShown {
  if (reading.kind === 'unknown') return { value: '—', detail: t(`${STATS_KEYS}.unknown`) };
  if (reading.kind === 'not-yet') {
    return { value: '—', detail: t(`${STATS_KEYS}.kpi.viewsNotYet`, { date: formatCalendarDay(reading.countingSince) }) };
  }
  const detail = reading.days < windowDays
    ? t(`${STATS_KEYS}.kpi.viewsCounted`, { days: reading.days })
    : t(`${STATS_KEYS}.kpi.inRange`, { days: windowDays });
  return { value: formatCount(reading.views), detail };
}

export interface KpiProps {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly detail?: React.ReactNode;
  /** `panel` = πίνακας λεπτομέρειας (ελεύθερο ύψος) · `card` = πλακίδιο κάρτας (δηλωμένο ύψος ανά γραμμή). */
  readonly density?: 'panel' | 'card';
}

/** Ένας δείκτης: όρος · τιμή · λεπτομέρεια. `<dl>` επειδή αυτό είναι. */
export function Kpi({ label, value, detail, density = 'panel' }: KpiProps): React.ReactElement {
  if (density === 'card') {
    // Η γραμμή λεπτομέρειας αποδίδεται ΠΑΝΤΑ (κενή αν δεν υπάρχει): το ύψος του πλακιδίου δεν εξαρτάται από αυτήν.
    return (
      <dl className={cn('m-0', CARD_KPI_TILE)}>
        <dt className={cn(CARD_KPI_LINE.label, 'text-muted-foreground')}>{label}</dt>
        <dd className={cn('m-0 font-semibold tabular-nums text-foreground', CARD_KPI_LINE.value)}>{value}</dd>
        <dd className={cn('m-0 text-muted-foreground', CARD_KPI_LINE.detail)}>{detail}</dd>
      </dl>
    );
  }
  return (
    <dl className="m-0 flex flex-col gap-1 rounded-md border border-border p-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="m-0 text-2xl font-semibold tabular-nums text-foreground">{value}</dd>
      {detail !== undefined && <dd className="m-0 text-xs text-muted-foreground">{detail}</dd>}
    </dl>
  );
}
