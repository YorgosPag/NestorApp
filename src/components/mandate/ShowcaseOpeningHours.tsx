'use client';

/**
 * @fileoverview 🏆 **«ΑΝΟΙΧΤΟ ΤΩΡΑ · ΚΛΕΙΝΕΙ ΣΤΙΣ 21:00»** — και οι επόμενες 7 ημέρες (ADR-841 §7 Α21.16 · Α21.16.8 · Α21.21).
 * @related lib/calendar/hours-timeline.ts (`openStateAt` · `upcomingDays`) · lib/calendar/special-hours.ts
 * @module components/mandate/ShowcaseOpeningHours
 *
 * 🏆 **Ό,τι κάνει η Google στο Business Profile και ΚΑΜΙΑ πλατφόρμα ακινήτων** — με προσθήκες:
 *   • η ώρα είναι **ώρα Ελλάδας**, όχι του φυλλομετρητή (ο επισκέπτης από το Λονδίνο ρωτά για
 *     γραφείο στη Θεσσαλονίκη)·
 *   • σε **αργία χωρίς δήλωση** λέει *«το ωράριο ίσως διαφέρει»* — ποτέ ψευδές «ανοιχτό», ποτέ εικαζόμενο «κλειστό»·
 *     σε αργία που **ήδη** είναι κλειστά λέει απλώς «Κλειστό» (Α21.21)·
 *   • όταν το επόμενο άνοιγμα είναι **μετά** από τέτοια αργία, το λέει (Α21.21) — δεν «ανοίγει Τρίτη» σιωπηλά.
 *
 * Α21.21 — ο πίνακας είναι **7 ημερομηνίες από σήμερα** (όπως το Google Maps), όχι «Δευτέρα–Κυριακή»: με ειδικές ώρες
 * η Τρίτη αυτής της εβδομάδας δεν είναι η Τρίτη της επόμενης.
 *
 * ♿ **Το κανάλι κατάστασης είναι ΚΕΙΜΕΝΟ** (CHECK 3.41): «Ανοιχτό»/«Κλειστό» διαβάζονται χωρίς
 * χρώμα. Ο πίνακας ζει σε `<details>` — ανοίγει με πληκτρολόγιο, χωρίς JavaScript.
 */

import React from 'react';
import { Clock } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay, formatWeekdayFromToday } from '@/lib/intl-formatting';
import { isSoon, openStateAt, upcomingDays, type CalendarDay, type OpenState } from '@/lib/calendar/hours-timeline';
import type { SpecialDay } from '@/lib/calendar/special-hours';
import { isAllDay, type DailyInterval, type WeeklyHours } from '@/lib/calendar/weekly-hours';
import { AGENCY_PUBLIC_NS, PROFILE_HOLIDAY_KEYS, PROFILE_KEYS } from './agency-directory-labels';

type Translate = ReturnType<typeof useTranslation>['t'];

const TABLE_DAYS = 7;

/** Ανανέωση ανά λεπτό — το «κλείνει σε λίγο» δεν επιτρέπεται να μείνει αληθινό μετά το κλείσιμο. */
function useMinuteClock(): Date {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** **Κατάσταση → πρόταση** — μία απόφαση ανά κλάδο, το «σύντομα» πάντα πρώτο (αυτό θέλει να μάθει ο επισκέπτης). */
function openStateText(state: OpenState, t: Translate): string {
  if (state.kind === 'holiday') {
    return t(PROFILE_KEYS.cardHoliday, { holiday: t(PROFILE_HOLIDAY_KEYS[state.holiday]) });
  }
  if (state.kind === 'open') {
    const { closes } = state;
    if (closes === null) return t(PROFILE_KEYS.cardOpenAllDay);
    if (isSoon(closes)) return t(PROFILE_KEYS.cardClosesSoon, { time: closes.time });
    if (closes.inDays === 0) return t(PROFILE_KEYS.cardOpenNow, { time: closes.time });
    return t(PROFILE_KEYS.cardClosesLater, { day: formatWeekdayFromToday(closes.weekday, closes.inDays), time: closes.time });
  }
  const { next } = state;
  if (next === null) return t(PROFILE_KEYS.cardClosedWeek);
  if (isSoon(next)) return t(PROFILE_KEYS.cardOpensSoon, { time: next.time });
  if (next.inDays === 0) return t(PROFILE_KEYS.cardOpensToday, { time: next.time });
  return t(PROFILE_KEYS.cardOpensLater, { day: formatWeekdayFromToday(next.weekday, next.inDays), time: next.time });
}

/** Α21.21 — η αργία χωρίς δήλωση **πριν** από το επόμενο άνοιγμα, ή `null`. */
function uncertainText(state: OpenState, t: Translate): string | null {
  if (state.kind !== 'closed' || state.uncertain === null) return null;
  const { weekday, inDays, holiday } = state.uncertain;
  return t(PROFILE_KEYS.cardHolidayAhead, { day: formatWeekdayFromToday(weekday, inDays), holiday: t(PROFILE_HOLIDAY_KEYS[holiday]) });
}

function intervalsText(intervals: readonly DailyInterval[], t: Translate): string {
  if (intervals.length === 0) return t(PROFILE_KEYS.cardClosedDay);
  return intervals
    .map((interval) => (isAllDay(interval) ? t(PROFILE_KEYS.cardOpenAllDay) : `${interval.opens}–${interval.closes}`))
    .join(', ');
}

function DayRow({ day, t }: { readonly day: CalendarDay; readonly t: Translate }): React.ReactElement {
  const { plan } = day;
  return (
    <tr className={day.inDays === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
      <th scope="row" className="pr-4 text-left align-top font-[inherit]">
        {formatCalendarDay(day.dateKey)}
        {day.inDays === 0 ? <span className="sr-only"> ({t(PROFILE_KEYS.cardToday)})</span> : null}
        {plan.kind === 'known' && plan.holiday !== null ? (
          <span className="block text-xs font-normal">{t(PROFILE_HOLIDAY_KEYS[plan.holiday])}</span>
        ) : null}
      </th>
      <td className="align-top">
        {plan.kind === 'unknown'
          ? t(PROFILE_KEYS.cardHolidayRow, { holiday: t(PROFILE_HOLIDAY_KEYS[plan.holiday]) })
          : intervalsText(plan.intervals, t)}
        {plan.kind === 'known' && plan.source !== 'weekly' ? (
          <span className="block text-xs font-normal">{t(PROFILE_KEYS.cardSpecialDay)}</span>
        ) : null}
      </td>
    </tr>
  );
}

export function ShowcaseOpeningHours({ hours, special }: {
  readonly hours: WeeklyHours;
  readonly special: readonly SpecialDay[];
}): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const now = useMinuteClock();
  const state = openStateAt(hours, now, { special });
  const ahead = uncertainText(state, t);

  return (
    <section className="flex flex-col gap-1">
      <p className="m-0 flex items-center gap-2 text-sm font-medium text-foreground">
        <Clock aria-hidden="true" className="h-4 w-4" /> {openStateText(state, t)}
      </p>
      {ahead !== null ? <p className="m-0 text-xs text-muted-foreground">{ahead}</p> : null}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">{t(PROFILE_KEYS.cardHoursTitle)}</summary>
        <table className="mt-2 border-collapse text-sm">
          <tbody>
            {upcomingDays(hours, now, TABLE_DAYS, { special }).map((day) => (
              <DayRow key={day.dateKey} day={day} t={t} />
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
