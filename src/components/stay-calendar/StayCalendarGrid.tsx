'use client';

/**
 * **Το μηνιαίο πλέγμα νυχτών του οικοδεσπότη** — πάνω στον κοινό σκελετό `StayMonthGridFrame`.
 *
 * 🔑 **Κάθε κατάσταση έχει ΣΧΗΜΑ, όχι μόνο χρώμα** (WCAG 1.4.1, CHECK 3.41): κλειστή =
 * λουκέτο, άλλο κανάλι = σύνδεσμος, κράτηση = άνθρωπος, επιλογή = περίγραμμα, «όχι άφιξη» /
 * «όχι αναχώρηση» = πόρτα εισόδου / εξόδου (Στάδιο Β). Το `aria-label` τα λέει με λέξεις.
 *
 * 💶 **Η τιμή της νύχτας στο κελί** (Στάδιο Β) — υπέρβαση ημέρας ή τιμή της αγγελίας, από
 * τον ΕΝΑ επιλυτή (`nightlyRateOn`). Η υπέρβαση φαίνεται **έντονη**, ώστε ο οικοδεσπότης να
 * ξεχωρίζει τι όρισε ο ίδιος από τη βάση.
 *
 * @related ADR-835 §20 · §21 · components/stay-calendar/StayMonthGridFrame.tsx
 */

import React from 'react';
import { Link2, Lock, LogIn, LogOut, UserRound } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import { formatMinor } from '@/lib/money/money';
import type { PricedPropertyLike } from '@/lib/properties/price-resolver';
import { nightStateOf, type StayNightSelection, type StayNightState } from '@/lib/stay/stay-calendar-month';
import { isPendingEntry } from '@/lib/stay/stay-calendar-optimistic';
import type { StayCalendarEntryView } from '@/lib/stay/stay-calendar-view';
import { nightlyRateOn } from '@/lib/stay/stay-nightly-quote';
import { dayRuleOn } from '@/lib/stay/stay-rules';
import { cn } from '@/lib/utils';
import type { StayDayRules } from '@/types/stay-rules';

import { StayMonthGridFrame, type StayGridCellBindings } from './StayMonthGridFrame';

/** Κλειδιά ως ΚΥΡΙΟΛΕΚΤΙΚΑ — η γεννήτρια των route slices τα διαβάζει από εδώ (ADR-744). */
const CELL_LABEL = {
  free: 'property-market:offer.stayCalendar.cell.free',
  blocked: 'property-market:offer.stayCalendar.cell.blocked',
  external: 'property-market:offer.stayCalendar.cell.external',
  booked: 'property-market:offer.stayCalendar.cell.booked',
  pending: 'property-market:offer.stayCalendar.cell.pending',
  // Στάδιο Δ (§23.8): ζωντανό αίτημα επισκέπτη — κρατά τη νύχτα ως την προθεσμία.
  requested: 'property-market:offer.stayCalendar.cell.requested',
} as const;

interface StayCalendarGridProps {
  readonly monthKey: string;
  readonly entries: readonly StayCalendarEntryView[];
  readonly days: StayDayRules;
  /** Η τιμή βάσης της αγγελίας, στο σχήμα του επιλυτή τιμής. */
  readonly pricing: PricedPropertyLike;
  readonly selection: StayNightSelection | null;
  readonly focusDay: string;
  readonly onFocusDay: (day: string) => void;
  /** Κλικ/Enter σε νύχτα· `extend` = Shift (επέκταση από την άγκυρα). */
  readonly onPick: (day: string, extend: boolean) => void;
}

function cellLabelKey(state: StayNightState): keyof typeof CELL_LABEL {
  if (state.kind === 'free') return 'free';
  if (isPendingEntry(state.entry)) return 'pending';
  if (state.kind === 'booked') return state.entry.lifecycle === 'requested' ? 'requested' : 'booked';
  return state.entry.source === 'external' ? 'external' : 'blocked';
}

function CellMarks({ state, day, days }: {
  readonly state: StayNightState;
  readonly day: string;
  readonly days: StayDayRules;
}): React.ReactElement {
  const rule = dayRuleOn(days, day);
  const Entry = state.kind === 'free' ? null : state.kind === 'booked' ? UserRound : state.entry.source === 'external' ? Link2 : Lock;
  return (
    <span className="flex items-center gap-0.5" aria-hidden>
      {Entry !== null && <Entry className="size-3.5" />}
      {rule.closedToArrival === true && <LogIn className="size-3" />}
      {rule.closedToDeparture === true && <LogOut className="size-3" />}
    </span>
  );
}

interface NightCellProps {
  readonly day: string;
  readonly state: StayNightState;
  readonly selected: boolean;
  readonly days: StayDayRules;
  readonly pricing: PricedPropertyLike;
  readonly bindings: StayGridCellBindings;
  readonly onPick: (day: string, extend: boolean) => void;
}

/** Η περιγραφή του κελιού με λέξεις: κατάσταση + κανόνες + τιμή. */
function useCellLabel({ day, state, days, pricing }: Pick<NightCellProps, 'day' | 'state' | 'days' | 'pricing'>): string {
  const { t } = useTranslation(['property-market']);
  const rule = dayRuleOn(days, day);
  const rate = nightlyRateOn(pricing, days, day);
  const parts = [t(CELL_LABEL[cellLabelKey(state)], { day: formatCalendarDay(day, true) })];
  if (rule.closedToArrival === true) parts.push(t('property-market:offer.stayCalendar.days.cellNoArrival'));
  if (rule.closedToDeparture === true) parts.push(t('property-market:offer.stayCalendar.days.cellNoDeparture'));
  if (rule.minNights !== undefined) parts.push(t('property-market:offer.stayCalendar.days.cellMinNights', { count: rule.minNights }));
  if (rate !== null) parts.push(formatMinor(rate.amountMinor));
  return parts.join(' · ');
}

function NightCell({ day, state, selected, days, pricing, bindings, onPick }: NightCellProps): React.ReactElement {
  const label = useCellLabel({ day, state, days, pricing });
  const pending = state.kind !== 'free' && isPendingEntry(state.entry);
  const rate = nightlyRateOn(pricing, days, day);
  return (
    <td role="gridcell" aria-selected={selected}>
      <button
        {...bindings}
        type="button"
        aria-label={label}
        onClick={(event) => onPick(day, event.shiftKey)}
        className={cn(
          'flex h-16 w-full flex-col items-center justify-center gap-0.5 rounded-md border text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          state.kind === 'free' && 'border-border bg-card text-foreground hover:bg-accent/50',
          state.kind === 'blocked' && 'border-border bg-muted text-muted-foreground',
          state.kind === 'booked' && state.entry.lifecycle !== 'requested' && 'border-foreground/40 bg-accent text-foreground',
          // Αίτημα σε αναμονή: διακεκομμένο περίγραμμα — η νύχτα κρατιέται, δεν έχει δοθεί.
          state.kind === 'booked' && state.entry.lifecycle === 'requested' && 'border-dashed border-foreground/40 bg-card text-foreground',
          selected && 'ring-2 ring-foreground',
          pending && 'opacity-60',
        )}
      >
        <span>{Number(day.slice(8))}</span>
        <CellMarks state={state} day={day} days={days} />
        {rate !== null && (
          <span aria-hidden className={cn('text-[0.65rem] leading-none', rate.source === 'day' ? 'font-semibold' : 'text-muted-foreground')}>
            {formatMinor(rate.amountMinor)}
          </span>
        )}
      </button>
    </td>
  );
}

function inSelection(day: string, selection: StayNightSelection | null): boolean {
  return selection !== null && selection.from <= day && day < selection.to;
}

export function StayCalendarGrid(props: StayCalendarGridProps): React.ReactElement {
  const { monthKey, entries, days, pricing, selection, focusDay, onFocusDay, onPick } = props;
  return (
    <StayMonthGridFrame
      monthKey={monthKey}
      focusDay={focusDay}
      onFocusDay={onFocusDay}
      onExtend={(day) => onPick(day, true)}
      renderCell={(day, bindings) => (
        <NightCell
          day={day} state={nightStateOf(day, entries)} selected={inSelection(day, selection)}
          days={days} pricing={pricing} bindings={bindings} onPick={onPick}
        />
      )}
    />
  );
}
