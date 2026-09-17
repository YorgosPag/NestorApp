'use client';

/**
 * @fileoverview **Η αλληλεπίδραση με το πλέγμα** — μήνας, εστίαση, επιλογή νυχτών.
 * @related ADR-835 §20 (Στάδιο Α) · lib/stay/stay-calendar-month.ts
 * @module hooks/owner-property/useStayCalendarSelection
 *
 * 🔑 **Η εστίαση σέρνει τον μήνα**: βέλος από τις 31/10 στην 1/11 αλλάζει μήνα. Αλλιώς
 * η εστίαση θα χανόταν σε κελί που δεν αποδίδεται, και ο χρήστης πληκτρολογίου θα
 * «έπεφτε» από το πλέγμα χωρίς να το ξέρει.
 */

import React from 'react';
import { todayLocalDate } from '@/lib/date-local';
import {
  addMonthsToMonthKey,
  monthKeyOf,
  selectionOf,
  type StayNightSelection,
} from '@/lib/stay/stay-calendar-month';

export interface StayCalendarSelectionController {
  readonly today: string;
  readonly monthKey: string;
  readonly focusDay: string;
  readonly selection: StayNightSelection | null;
  readonly shiftMonth: (months: number) => void;
  readonly moveFocus: (day: string) => void;
  /** Κλικ/Enter· `extend` = Shift. Χωρίς άγκυρα ή με ολοκληρωμένη επιλογή ⇒ νέα αρχή. */
  readonly pick: (day: string, extend: boolean) => void;
  readonly clear: () => void;
}

interface Picking {
  readonly anchor: string | null;
  readonly focus: string | null;
}

export function useStayCalendarSelection(): StayCalendarSelectionController {
  const today = todayLocalDate();
  const [monthKey, setMonthKey] = React.useState(() => monthKeyOf(today));
  const [focusDay, setFocusDay] = React.useState(today);
  const [picking, setPicking] = React.useState<Picking>({ anchor: null, focus: null });

  const moveFocus = React.useCallback((day: string) => {
    setFocusDay(day);
    setMonthKey(monthKeyOf(day));
  }, []);

  const pick = React.useCallback((day: string, extend: boolean) => {
    setPicking((current) => {
      const complete = current.anchor !== null && current.focus !== current.anchor;
      if (current.anchor === null || (!extend && complete)) return { anchor: day, focus: day };
      return { anchor: current.anchor, focus: day };
    });
  }, []);

  const clear = React.useCallback(() => setPicking({ anchor: null, focus: null }), []);
  const shiftMonth = React.useCallback((months: number) => setMonthKey((current) => addMonthsToMonthKey(current, months)), []);

  const selection = picking.anchor !== null && picking.focus !== null ? selectionOf(picking.anchor, picking.focus) : null;
  return { today, monthKey, focusDay, selection, shiftMonth, moveFocus, pick, clear };
}
