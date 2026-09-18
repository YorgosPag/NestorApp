'use client';

/**
 * **Η απάντηση για τις ημερομηνίες του επισκέπτη** — με όνομα, διέξοδο και τιμολόγηση ανά νύχτα.
 *
 * 🏆 Εκεί όπου η αγορά γράφει «μη διαθέσιμο», εδώ λέμε **γιατί** και **τι μπορείς να κάνεις**:
 * νωρίτερη άφιξη, κοντινότερη επιτρεπτή μέρα, «ελεύθερο ξανά από», τα κομμάτια που χωράνε.
 * Η τιμή δίνεται **σύνολο + ανάλυση ανά νύχτα** (Omnibus: ο επισκέπτης βλέπει τι πληρώνει).
 *
 * @related ADR-835 §4.7 · §18.4 · §21 · lib/stay/stay-availability-vocabulary.ts · lib/stay/stay-nightly-quote.ts
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay, formatDateTime, formatList } from '@/lib/intl-formatting';
import { formatMinor } from '@/lib/money/money';
import { isStayable, type StayAvailabilityAnswer } from '@/lib/stay/stay-availability-vocabulary';
import { STAY_HOLD_TIME_FORMAT } from '@/lib/stay/stay-hold-deadline';
import type { StayQuote } from '@/lib/stay/stay-nightly-quote';
import type { StayAnswersState } from '@/hooks/listings/useStayAnswers';

/** Η κύρια πρόταση — κλειδιά ΚΥΡΙΟΛΕΚΤΙΚΑ (ADR-744), παράμετροι από την απάντηση. */
function headlineOf(answer: StayAvailabilityAnswer, t: (key: string, params?: Record<string, unknown>) => string): string {
  switch (answer.kind) {
    case 'free': return t('short-stay:answer.free');
    case 'conditional':
      return answer.conditionalFrom === null
        ? t('short-stay:answer.conditional')
        : t('short-stay:answer.conditionalFrom', { date: formatCalendarDay(answer.conditionalFrom, true) });
    case 'occupied': return t('short-stay:answer.occupied');
    // 🏆 Στάδιο Δ (§23.5): «σε αναμονή ως …», όχι σκέτο «κλειστό» — θα ελευθερωθεί αν δεν απαντηθεί.
    case 'held': return t('short-stay:answer.held', { until: formatDateTime(answer.until, STAY_HOLD_TIME_FORMAT) });
    case 'below-min-nights': return t('short-stay:answer.below-min-nights', { minNights: answer.minNights });
    case 'above-max-nights': return t('short-stay:answer.above-max-nights', { maxNights: answer.maxNights });
    case 'advance-notice': return t('short-stay:answer.advance-notice', { date: formatCalendarDay(answer.earliestCheckIn, true) });
    case 'outside-window': return t('short-stay:answer.outside-window', { date: formatCalendarDay(answer.bookableUntil, true) });
    case 'arrival-not-allowed': return t('short-stay:answer.arrival-not-allowed');
    case 'departure-not-allowed': return t('short-stay:answer.departure-not-allowed');
    case 'over-capacity': return t('short-stay:answer.over-capacity', { maxGuests: answer.maxGuests });
    case 'terms-unknown': return t('short-stay:answer.terms-unknown');
    // ADR-777 §8.60.21 — κατοικίδια: τρία εμπόδια + μία επιφύλαξη του «ελεύθερο».
    case 'pets-unknown': return t('short-stay:answer.pets-unknown');
    case 'pets-not-allowed': return t('short-stay:answer.pets-not-allowed');
    case 'over-pet-limit': return t('short-stay:answer.over-pet-limit', { maxPets: answer.maxPets });
    case 'pets-on-request': return t('short-stay:answer.pets-on-request');
    case 'unknown': return t('short-stay:answer.unknown');
    case 'unreadable': return t('short-stay:answer.unreadable');
    case 'unsynced': return t('short-stay:answer.unsynced');
    case 'not-a-stay': return t('short-stay:answer.not-a-stay');
  }
}

/** Οι διέξοδοι — ό,τι μπορεί να κάνει ο άνθρωπος αντί για αδιέξοδο. */
function remediesOf(answer: StayAvailabilityAnswer, t: (key: string, params?: Record<string, unknown>) => string): string[] {
  const out: string[] = [];
  if (answer.kind === 'occupied') {
    if (answer.nextFreeFrom !== null) out.push(t('short-stay:answer.nextFreeFrom', { date: formatCalendarDay(answer.nextFreeFrom, true) }));
    if (answer.freeRuns.length > 0) {
      const runs = answer.freeRuns.map((run) => `${formatCalendarDay(run.from)}–${formatCalendarDay(run.to)}`);
      out.push(t('short-stay:answer.freeRuns', { runs: formatList(runs) }));
    }
  }
  if (answer.kind === 'arrival-not-allowed' || answer.kind === 'departure-not-allowed') {
    const dates = [answer.nearestBefore, answer.nearestAfter].filter((d): d is string => d !== null);
    if (dates.length > 0) out.push(t('short-stay:answer.nearest', { dates: formatList(dates.map((d) => formatCalendarDay(d, true))) }));
  }
  return out;
}

function QuoteView({ quote }: { readonly quote: StayQuote }): React.ReactElement {
  const { t } = useTranslation(['short-stay']);
  if (quote.kind === 'unpriced') return <p className="text-sm text-muted-foreground">{t('short-stay:quote.unpriced')}</p>;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-foreground">
        {t('short-stay:quote.total', { total: formatMinor(quote.totalMinor), count: quote.nights.length })}
      </summary>
      <p className="mt-1 text-xs text-muted-foreground">{t('short-stay:quote.breakdown')}</p>
      <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
        {quote.nights.map((night) => (
          <li key={night.date}>{t('short-stay:quote.night', { date: formatCalendarDay(night.date), amount: formatMinor(night.amountMinor) })}</li>
        ))}
      </ul>
    </details>
  );
}

export function ListingStayAnswer({ listingId, state }: {
  readonly listingId: string;
  readonly state: StayAnswersState;
}): React.ReactElement | null {
  const { t } = useTranslation(['short-stay']);
  if (state.kind === 'idle') return null;
  if (state.kind === 'pending') return <p role="status" className="text-sm text-muted-foreground">{t('short-stay:answer.checking')}</p>;
  const result = state.kind === 'loaded' ? state.answers[listingId] : undefined;
  if (result === undefined) return <p role="alert" className="text-sm text-foreground">{t('short-stay:answer.failed')}</p>;
  // 🔑 Η ΜΙΑ απάντηση στο «μπορείς να μείνεις;» — ποτέ ξαναγραμμένη λίστα κάδων (Boy Scout, Στάδιο Δ).
  const stayable = isStayable(result.answer.kind);
  return (
    <output aria-live="polite" className="flex flex-col gap-1">
      <p className="text-sm font-medium text-foreground">{headlineOf(result.answer, t)}</p>
      {remediesOf(result.answer, t).map((line) => <p key={line} className="text-sm text-muted-foreground">{line}</p>)}
      {stayable && result.quote !== null && <QuoteView quote={result.quote} />}
    </output>
  );
}
