'use client';

/**
 * **Το δημόσιο ημερολόγιο στη σελίδα της αγγελίας** — γκρι μέρες, «μόνο αναχώρηση», επιλογή εύρους.
 *
 * 🔑 **Πάνω στον ΙΔΙΟ σκελετό με το ημερολόγιο του οικοδεσπότη** (`StayMonthGridFrame`): ίδια
 * πλοήγηση, ίδια προσβασιμότητα. Διαφέρει μόνο το **νόημα** κάθε κελιού, και αυτό βγαίνει από
 * το `stayDayMeaning` — ποτέ από χρώμα μόνο (WCAG 1.4.1): κάθε κατάσταση έχει λέξη στο
 * `aria-label`, και η εστιασμένη μέρα **εξηγείται** ορατά κάτω από το πλέγμα (🏆 αντί για
 * σκέτο γκρι).
 *
 * ⛔ **Χωρίς ποιος ή γιατί**: η διαδρομή στέλνει μόνο κατάσταση + σημαίες + ελάχιστες νύχτες.
 *
 * @related ADR-835 §4.5 · §20.3 #1 · §21 · lib/stay/stay-public-selection.ts
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay, formatCalendarMonth, formatDateTime } from '@/lib/intl-formatting';
import { STAY_HOLD_TIME_FORMAT } from '@/lib/stay/stay-hold-deadline';
import { addMonthsToMonthKey } from '@/lib/stay/stay-calendar-month';
import type { StayPublicNight } from '@/lib/stay/stay-nights-view';
import {
  isSelectableMeaning,
  nightsIndex,
  stayDayMeaning,
  type StayDayMeaning,
  type StayPublicSelection,
} from '@/lib/stay/stay-public-selection';
import { cn } from '@/lib/utils';
import { StayMonthGridFrame } from '@/components/stay-calendar/StayMonthGridFrame';

/** Κλειδιά ως ΚΥΡΙΟΛΕΚΤΙΚΑ — η γεννήτρια των route slices τα διαβάζει από εδώ (ADR-744). */
const CELL_LABEL: Readonly<Record<StayDayMeaning, string>> = {
  'check-in': 'short-stay:calendar.cell.check-in',
  'check-out': 'short-stay:calendar.cell.check-out',
  'check-out-only': 'short-stay:calendar.cell.check-out-only',
  'no-arrival': 'short-stay:calendar.cell.no-arrival',
  closed: 'short-stay:calendar.cell.closed',
  unsynced: 'short-stay:calendar.cell.unsynced',
  held: 'short-stay:calendar.cell.held',
  'selected-check-in': 'short-stay:calendar.cell.selected-check-in',
  'selected-check-out': 'short-stay:calendar.cell.selected-check-out',
  'in-stay': 'short-stay:calendar.cell.in-stay',
};

/** 🔴 §23.12 Ε3 — η νύχτα `held` του **δικού μου** αιτήματος· κυριολεκτικό, όπως τα παραπάνω (ADR-744). */
const HELD_MINE_LABEL = 'short-stay:calendar.cell.heldMine';

const CELL_TONE: Readonly<Record<StayDayMeaning, string>> = {
  'check-in': 'border-border bg-card text-foreground hover:bg-accent/50',
  'check-out': 'border-foreground/40 bg-card text-foreground hover:bg-accent/50',
  'check-out-only': 'border-dashed border-border bg-muted text-foreground',
  'no-arrival': 'border-border bg-card text-muted-foreground',
  closed: 'border-border bg-muted text-muted-foreground line-through',
  // «Δεν ξέρουμε»: διαγώνια υπόδειξη + λέξη στο aria-label — ποτέ όψη ελεύθερης μέρας.
  unsynced: 'border-dashed border-muted-foreground/60 bg-card text-muted-foreground',
  // «Σε αναμονή»: όψη κλειστής (δεν επιλέγεται) με διακεκομμένο περίγραμμα — θα ανοίξει μόνη της.
  held: 'border-dashed border-border bg-muted text-muted-foreground',
  // ⚠️ Κείμενο ΠΟΤΕ με token επιφάνειας (CHECK 3.38): η επιλογή = περίγραμμα + βάρος, όχι αντιστροφή.
  'selected-check-in': 'border-foreground bg-accent font-semibold text-foreground ring-2 ring-foreground',
  'selected-check-out': 'border-foreground bg-accent font-semibold text-foreground ring-2 ring-foreground',
  'in-stay': 'border-foreground/40 bg-accent text-foreground',
};

/** Η περιγραφή μιας μέρας με λέξεις: νόημα + ελάχιστη διαμονή + αίρεση. */
function useStayDayDescription(
  isMine: (day: string) => boolean,
): (day: string, meaning: StayDayMeaning, night: StayPublicNight | undefined) => string {
  const { t } = useTranslation(['short-stay']);
  return (day, meaning, night) => {
    const label = meaning === 'held' && isMine(day) ? HELD_MINE_LABEL : CELL_LABEL[meaning];
    const parts = [t(label, { day: formatCalendarDay(day, true) })];
    if (meaning === 'check-in' && night?.minNights !== null && night?.minNights !== undefined && night.minNights > 1) {
      parts.push(t('short-stay:calendar.minNights', { count: night.minNights }));
    }
    if (night?.state === 'conditional') parts.push(t('short-stay:calendar.conditional'));
    if (night?.state === 'held' && night.heldUntil !== null) {
      parts.push(t('short-stay:calendar.heldUntil', { until: formatDateTime(night.heldUntil, STAY_HOLD_TIME_FORMAT) }));
    }
    return parts.join(' · ');
  };
}

interface ListingStayMonthProps {
  readonly monthKey: string;
  readonly nights: readonly StayPublicNight[];
  readonly selection: StayPublicSelection;
  readonly focusDay: string;
  readonly onFocusDay: (day: string) => void;
  readonly onPick: (day: string) => void;
  readonly isMine: (day: string) => boolean;
}

function ListingStayMonth({ monthKey, nights, selection, focusDay, onFocusDay, onPick, isMine }: ListingStayMonthProps): React.ReactElement {
  const { t } = useTranslation(['short-stay']);
  const describe = useStayDayDescription(isMine);
  const index = React.useMemo(() => nightsIndex(nights), [nights]);
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-medium text-foreground">{formatCalendarMonth(monthKey)}</h3>
      <StayMonthGridFrame
        monthKey={monthKey} focusDay={focusDay} onFocusDay={onFocusDay}
        label={t('short-stay:calendar.gridLabel', { month: formatCalendarMonth(monthKey) })}
        renderCell={(day, bindings) => {
          const meaning = stayDayMeaning(day, nights, selection);
          const night = index.get(day);
          const selectable = isSelectableMeaning(meaning);
          return (
            <td role="gridcell" aria-selected={meaning.startsWith('selected') || meaning === 'in-stay'}>
              <button
                {...bindings} type="button" aria-disabled={!selectable} aria-label={describe(day, meaning, night)}
                onClick={() => { if (selectable) onPick(day); }}
                className={cn('flex h-10 w-full items-center justify-center rounded-md border text-sm', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', CELL_TONE[meaning], night?.state === 'conditional' && 'underline decoration-dotted')}
              >
                {Number(day.slice(8))}
              </button>
            </td>
          );
        }}
      />
    </section>
  );
}

interface ListingStayCalendarProps {
  readonly monthKey: string;
  readonly nights: readonly StayPublicNight[];
  readonly selection: StayPublicSelection;
  readonly onShiftMonth: (delta: number) => void;
  readonly onPick: (day: string) => void;
  /** Είναι η νύχτα μέρος **δικού μου** ζωντανού αιτήματος; (§23.12 Ε3 — ο ανώνυμος: πάντα όχι) */
  readonly isMine: (day: string) => boolean;
}

export function ListingStayCalendar({ monthKey, nights, selection, onShiftMonth, onPick, isMine }: ListingStayCalendarProps): React.ReactElement {
  const { t } = useTranslation(['short-stay']);
  const describe = useStayDayDescription(isMine);
  const [focusDay, setFocusDay] = React.useState(`${monthKey}-01`);
  const months = [monthKey, addMonthsToMonthKey(monthKey, 1)];
  const focusMeaning = stayDayMeaning(focusDay, nights, selection);

  return (
    <section className="flex flex-col gap-2">
      <nav className="flex items-center justify-between">
        <button type="button" onClick={() => onShiftMonth(-1)} className="text-sm text-foreground underline">{t('short-stay:calendar.previous')}</button>
        <button type="button" onClick={() => onShiftMonth(1)} className="text-sm text-foreground underline">{t('short-stay:calendar.next')}</button>
      </nav>
      <span className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {months.map((month) => (
          <ListingStayMonth
            key={month} monthKey={month} nights={nights} selection={selection}
            focusDay={focusDay} onFocusDay={setFocusDay} onPick={onPick} isMine={isMine}
          />
        ))}
      </span>
      {/* 🏆 Η εστιασμένη μέρα ΕΞΗΓΕΙΤΑΙ με λέξεις — όχι μόνο γκρι. */}
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {describe(focusDay, focusMeaning, nightsIndex(nights).get(focusDay))}
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li>{t('short-stay:calendar.legend.available')}</li>
        <li className="line-through">{t('short-stay:calendar.legend.closed')}</li>
        <li className="border-b border-dashed">{t('short-stay:calendar.legend.checkOutOnly')}</li>
        <li className="underline decoration-dotted">{t('short-stay:calendar.legend.conditional')}</li>
        <li className="border-b border-dashed text-muted-foreground">{t('short-stay:calendar.legend.held')}</li>
      </ul>
    </section>
  );
}
