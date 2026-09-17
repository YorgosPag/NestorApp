'use client';

/**
 * **Ο σκελετός ΚΑΘΕ μηνιαίου πλέγματος νυχτών** — ARIA grid, roving tabindex, βέλη.
 *
 * 🔑 **Ένας σκελετός, δύο πλέγματα** (ADR-835 §21, N.0.2): ο οικοδεσπότης (`StayCalendarGrid`)
 * και ο επισκέπτης (`ListingStayCalendar`) μοιράζονται **ακριβώς** την ίδια συμπεριφορά
 * πληκτρολογίου και προσβασιμότητας· διαφέρουν μόνο στο **τι λέει κάθε κελί**. Δύο αντίγραφα
 * θα απέκλιναν στην πρώτη διόρθωση προσβασιμότητας.
 *
 * ⌨️ Βέλη = μετακίνηση · Shift+βέλη = επέκταση (όπου το πλέγμα το δέχεται) · Enter/Space =
 * επιλογή. Ένα κελί στη σειρά Tab. ⚠️ **ΟΧΙ Escape** — η κλίμακα Escape έχει ΕΝΑΝ ιδιοκτήτη
 * (`escape-command-bus`, ADR-364, CHECK 3.7).
 *
 * @related ADR-835 §20 · §21 · lib/stay/stay-calendar-month.ts
 */

import React from 'react';
import { addDaysToDateKey } from '@/lib/calendar/date-key';
import { ISO_WEEKDAYS } from '@/lib/calendar/weekly-hours';
import { formatIsoWeekday } from '@/lib/intl-formatting';
import { monthGrid, monthKeyOf } from '@/lib/stay/stay-calendar-month';

const KEY_STEP: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

/** Ό,τι χρειάζεται το κουμπί ενός κελιού για να συμμετέχει στην πλοήγηση. */
export interface StayGridCellBindings {
  readonly tabIndex: 0 | -1;
  readonly ref: (node: HTMLButtonElement | null) => void;
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  readonly onFocus: () => void;
}

interface StayMonthGridFrameProps {
  readonly monthKey: string;
  readonly focusDay: string;
  readonly onFocusDay: (day: string) => void;
  /** Shift+βέλος: επέκταση επιλογής· `undefined` = το πλέγμα δεν επεκτείνει με πληκτρολόγιο. */
  readonly onExtend?: (day: string) => void;
  /** Το περιεχόμενο ενός κελιού `<td>` για την ημέρα. */
  readonly renderCell: (day: string, bindings: StayGridCellBindings) => React.ReactElement;
  readonly label?: string;
}

/** Η πλοήγηση: roving tabindex + βέλη, με εστίαση ΜΟΝΟ όταν την κίνησε το πληκτρολόγιο. */
function useGridNavigation(
  monthKey: string,
  focusDay: string,
  onFocusDay: (day: string) => void,
  onExtend: ((day: string) => void) | undefined,
): (day: string) => StayGridCellBindings {
  // Ένα κελί στη σειρά Tab ΠΑΝΤΑ — κι όταν η εστίαση έμεινε σε άλλον μήνα (κουμπιά μήνα).
  const tabbableDay = monthKeyOf(focusDay) === monthKey ? focusDay : `${monthKey}-01`;
  const cellRefs = React.useRef(new Map<string, HTMLButtonElement>());
  // Κλοπή εστίασης στη φόρτωση αποπροσανατολίζει τον αναγνώστη οθόνης.
  const keyboardMoved = React.useRef(false);

  React.useEffect(() => {
    if (!keyboardMoved.current) return;
    keyboardMoved.current = false;
    cellRefs.current.get(focusDay)?.focus({ preventScroll: true });
  }, [focusDay, monthKey]);

  return (day) => ({
    tabIndex: day === tabbableDay ? 0 : -1,
    ref: (node) => {
      if (node === null) cellRefs.current.delete(day);
      else cellRefs.current.set(day, node);
    },
    onKeyDown: (event) => {
      const step = KEY_STEP[event.key];
      if (step === undefined) return;
      event.preventDefault();
      const next = addDaysToDateKey(day, step);
      if (next === null) return;
      keyboardMoved.current = true;
      onFocusDay(next);
      if (event.shiftKey && onExtend !== undefined) onExtend(next);
    },
    onFocus: () => onFocusDay(day),
  });
}

export function StayMonthGridFrame(props: StayMonthGridFrameProps): React.ReactElement {
  const { monthKey, focusDay, onFocusDay, onExtend, renderCell, label } = props;
  const weeks = monthGrid(monthKey);
  const bindingsOf = useGridNavigation(monthKey, focusDay, onFocusDay, onExtend);

  return (
    <table role="grid" aria-label={label} className="w-full table-fixed border-separate border-spacing-1">
      <thead>
        <tr>
          {ISO_WEEKDAYS.map((weekday) => (
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
              : <React.Fragment key={day}>{renderCell(day, bindingsOf(day))}</React.Fragment>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
