'use client';

/**
 * **Το μηνιαίο πλέγμα νυχτών** — ARIA grid με πλοήγηση πληκτρολογίου.
 *
 * 🔑 **Κάθε κατάσταση έχει ΣΧΗΜΑ, όχι μόνο χρώμα** (WCAG 1.4.1, CHECK 3.41): κλειστή =
 * λουκέτο, άλλο κανάλι = σύνδεσμος, κράτηση = άνθρωπος, επιλογή = περίγραμμα. Το
 * `aria-label` κάθε κελιού λέει την κατάσταση με λέξεις.
 *
 * ⌨️ Βέλη = μετακίνηση · Shift+βέλη = επέκταση επιλογής · Enter/Space = αρχή ή τέλος
 * επιλογής. Ένα κελί μόνο είναι στη σειρά Tab (roving tabindex). Ο καθαρισμός γίνεται από
 * το ορατό κουμπί του πάνελ — ⚠️ ΟΧΙ με Escape: η κλίμακα Escape έχει ΕΝΑΝ ιδιοκτήτη
 * (`escape-command-bus`, ADR-364, CHECK 3.7), και ένα τοπικό `key === 'Escape'` θα ήταν
 * δεύτερος.
 *
 * @related ADR-835 §20 (Στάδιο Α) · lib/stay/stay-calendar-month.ts
 */

import React from 'react';
import { Link2, Lock, UserRound } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { addDaysToDateKey } from '@/lib/calendar/date-key';
import { formatCalendarDay, formatIsoWeekday } from '@/lib/intl-formatting';
import {
  monthGrid,
  monthKeyOf,
  nightStateOf,
  type StayNightSelection,
  type StayNightState,
} from '@/lib/stay/stay-calendar-month';
import { isPendingEntry } from '@/lib/stay/stay-calendar-optimistic';
import type { StayCalendarEntryView } from '@/lib/stay/stay-calendar-view';
import { cn } from '@/lib/utils';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const KEY_STEP: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

/** Κλειδιά ως ΚΥΡΙΟΛΕΚΤΙΚΑ — η γεννήτρια των route slices τα διαβάζει από εδώ (ADR-744). */
const CELL_LABEL = {
  free: 'property-market:offer.stayCalendar.cell.free',
  blocked: 'property-market:offer.stayCalendar.cell.blocked',
  external: 'property-market:offer.stayCalendar.cell.external',
  booked: 'property-market:offer.stayCalendar.cell.booked',
  pending: 'property-market:offer.stayCalendar.cell.pending',
} as const;

interface StayCalendarGridProps {
  readonly monthKey: string;
  readonly entries: readonly StayCalendarEntryView[];
  readonly selection: StayNightSelection | null;
  readonly focusDay: string;
  readonly onFocusDay: (day: string) => void;
  /** Κλικ/Enter σε νύχτα· `extend` = Shift (επέκταση από την άγκυρα). */
  readonly onPick: (day: string, extend: boolean) => void;
}

function cellLabelKey(state: StayNightState): keyof typeof CELL_LABEL {
  if (state.kind === 'free') return 'free';
  if (isPendingEntry(state.entry)) return 'pending';
  if (state.kind === 'booked') return 'booked';
  return state.entry.source === 'external' ? 'external' : 'blocked';
}

function CellMark({ state }: { readonly state: StayNightState }): React.ReactElement | null {
  if (state.kind === 'free') return null;
  const Icon = state.kind === 'booked' ? UserRound : state.entry.source === 'external' ? Link2 : Lock;
  return <Icon aria-hidden className="size-3.5" />;
}

function inSelection(day: string, selection: StayNightSelection | null): boolean {
  return selection !== null && selection.from <= day && day < selection.to;
}

interface NightCellProps {
  readonly day: string;
  readonly state: StayNightState;
  readonly selected: boolean;
  readonly tabbable: boolean;
  readonly register: (day: string, node: HTMLButtonElement | null) => void;
  readonly onPick: (day: string, extend: boolean) => void;
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, day: string) => void;
  readonly onFocusDay: (day: string) => void;
}

function NightCell({ day, state, selected, tabbable, register, onPick, onKeyDown, onFocusDay }: NightCellProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const pending = state.kind !== 'free' && isPendingEntry(state.entry);
  return (
    <td role="gridcell" aria-selected={selected}>
      <button
        ref={(node) => register(day, node)}
        type="button"
        tabIndex={tabbable ? 0 : -1}
        aria-label={t(CELL_LABEL[cellLabelKey(state)], { day: formatCalendarDay(day, true) })}
        onClick={(event) => onPick(day, event.shiftKey)}
        onKeyDown={(event) => onKeyDown(event, day)}
        onFocus={() => onFocusDay(day)}
        className={cn(
          'flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-md border text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          state.kind === 'free' && 'border-border bg-card text-foreground hover:bg-accent/50',
          state.kind === 'blocked' && 'border-border bg-muted text-muted-foreground',
          state.kind === 'booked' && 'border-foreground/40 bg-accent text-foreground',
          selected && 'ring-2 ring-foreground',
          pending && 'opacity-60',
        )}
      >
        <span>{Number(day.slice(8))}</span>
        <CellMark state={state} />
      </button>
    </td>
  );
}

export function StayCalendarGrid(props: StayCalendarGridProps): React.ReactElement {
  const { monthKey, entries, selection, focusDay, onFocusDay, onPick } = props;
  const weeks = monthGrid(monthKey);
  // Ένα κελί στη σειρά Tab ΠΑΝΤΑ — κι όταν η εστίαση έμεινε σε άλλον μήνα (κουμπιά μήνα).
  const tabbableDay = monthKeyOf(focusDay) === monthKey ? focusDay : `${monthKey}-01`;
  const cellRefs = React.useRef(new Map<string, HTMLButtonElement>());
  // Η εστίαση μετακινείται ΜΟΝΟ όταν την κίνησε το πληκτρολόγιο μέσα στο πλέγμα — ποτέ στη
  // φόρτωση ή στο «Σήμερα»: κλοπή εστίασης αποπροσανατολίζει τον αναγνώστη οθόνης.
  const keyboardMoved = React.useRef(false);

  React.useEffect(() => {
    if (!keyboardMoved.current) return;
    keyboardMoved.current = false;
    cellRefs.current.get(focusDay)?.focus({ preventScroll: true });
  }, [focusDay, monthKey]);

  const register = React.useCallback((day: string, node: HTMLButtonElement | null) => {
    if (node === null) cellRefs.current.delete(day);
    else cellRefs.current.set(day, node);
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, day: string): void {
    const step = KEY_STEP[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = addDaysToDateKey(day, step);
    if (next === null) return;
    keyboardMoved.current = true;
    onFocusDay(next);
    if (event.shiftKey) onPick(next, true);
  }

  return (
    <table role="grid" aria-readonly="false" className="w-full table-fixed border-separate border-spacing-1">
      <thead>
        <tr>
          {WEEKDAYS.map((weekday) => (
            <th key={weekday} scope="col" className="text-xs font-medium text-muted-foreground">
              <span aria-hidden>{formatIsoWeekday(weekday, 'short')}</span>
              <span className="sr-only">{formatIsoWeekday(weekday, 'long')}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, row) => (
          <tr key={`${monthKey}-${row}`}>
            {week.map((day, column) => (day === null
              ? <td key={`${monthKey}-${row}-${column}`} role="presentation" />
              : (
                <NightCell
                  key={day} day={day} state={nightStateOf(day, entries)} selected={inSelection(day, selection)}
                  tabbable={day === tabbableDay} register={register} onPick={onPick}
                  onKeyDown={handleKeyDown} onFocusDay={onFocusDay}
                />
              )))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
