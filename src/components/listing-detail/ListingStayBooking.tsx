'use client';

/**
 * **Το ημερολόγιο διαμονής της αγγελίας** — φόρτωση ανά μήνα, επιλογή, απάντηση του διακομιστή.
 *
 * ⚠️ **Φορτώνεται με `next/dynamic` από το `ListingStay`** (ADR-744 · ADR-835 §21): βρίσκεται
 * κάτω από την πρώτη οθόνη, και τα κλειδιά του δεν ανήκουν στο σύγχρονο slice της σελίδας —
 * ίδιο πρότυπο με τον καμβά του 3Δ μοντέλου. **Default export** γι' αυτόν τον λόγο.
 *
 * 🔑 **Η τελική απάντηση έρχεται από τον ΔΙΑΚΟΜΙΣΤΗ** (`useStayAnswers`), όχι από το πλέγμα: το
 * πλέγμα είναι ένδειξη, η μηχανή ετυμηγορία — και η απάντηση φέρνει και την τιμολόγηση.
 *
 * @related ADR-835 §4.5 · §21 · hooks/listings/usePublicStayNights.ts · hooks/listings/useStayAnswers.ts
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useStayAnswers } from '@/hooks/listings/useStayAnswers';
import { usePublicStayNights } from '@/hooks/listings/usePublicStayNights';
import { formatCalendarDay } from '@/lib/intl-formatting';
import { addMonthsToMonthKey, monthKeyOf } from '@/lib/stay/stay-calendar-month';
import type { StayQuery } from '@/lib/stay/stay-availability-vocabulary';
import { NO_STAY_SELECTION, nextStaySelection, type StayPublicSelection } from '@/lib/stay/stay-public-selection';
import { todayLocalDate } from '@/lib/date-local';
import type { PublicListing } from '@/types/public-listing';

import { ListingStayAnswer } from './ListingStayAnswer';
import { ListingStayCalendar } from './ListingStayCalendar';

function queryOf(selection: StayPublicSelection): StayQuery | null {
  return selection.kind === 'range' ? { checkIn: selection.checkIn, checkOut: selection.checkOut, guests: null } : null;
}

function SelectionLine({ selection, onClear }: {
  readonly selection: StayPublicSelection;
  readonly onClear: () => void;
}): React.ReactElement {
  const { t } = useTranslation(['short-stay']);
  if (selection.kind === 'none') return <p className="text-sm text-muted-foreground">{t('short-stay:calendar.pickCheckIn')}</p>;
  if (selection.kind === 'check-in') return <p className="text-sm text-muted-foreground">{t('short-stay:calendar.pickCheckOut')}</p>;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-foreground">
      {t('short-stay:calendar.selected', { from: formatCalendarDay(selection.checkIn, true), to: formatCalendarDay(selection.checkOut, true) })}
      <button type="button" onClick={onClear} className="underline">{t('short-stay:calendar.clear')}</button>
    </p>
  );
}

export default function ListingStayBooking({ listing }: { readonly listing: PublicListing }): React.ReactElement {
  const { t } = useTranslation(['short-stay']);
  const [monthKey, setMonthKey] = React.useState(() => monthKeyOf(todayLocalDate()));
  const [selection, setSelection] = React.useState<StayPublicSelection>(NO_STAY_SELECTION);
  const { state, reload } = usePublicStayNights(listing.id, monthKey);
  const listingIds = React.useMemo(() => [listing.id], [listing.id]);
  const query = React.useMemo(() => queryOf(selection), [selection]);
  const answers = useStayAnswers(listingIds, query);

  if (state.kind === 'loading') return <p className="text-sm text-muted-foreground">{t('short-stay:calendar.loading')}</p>;
  if (state.kind === 'failed') {
    return (
      <p role="alert" className="flex items-center gap-2 text-sm text-foreground">
        {t('short-stay:calendar.failed')}
        <button type="button" onClick={reload} className="underline">{t('short-stay:calendar.retry')}</button>
      </p>
    );
  }
  if (state.nights.kind === 'undeclared') return <p className="text-sm text-foreground">{t('short-stay:calendar.undeclared')}</p>;
  if (state.nights.kind === 'unreadable') return <p role="alert" className="text-sm text-foreground">{t('short-stay:calendar.unreadable')}</p>;
  const nights = state.nights.nights;

  return (
    <>
      <SelectionLine selection={selection} onClear={() => setSelection(NO_STAY_SELECTION)} />
      <ListingStayCalendar
        monthKey={monthKey} nights={nights} selection={selection}
        onShiftMonth={(delta) => setMonthKey((current) => addMonthsToMonthKey(current, delta))}
        onPick={(day) => setSelection((current) => nextStaySelection(current, day, nights))}
      />
      <ListingStayAnswer listingId={listing.id} state={answers} />
    </>
  );
}
