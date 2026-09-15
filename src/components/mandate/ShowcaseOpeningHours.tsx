'use client';

/**
 * @fileoverview 🏆 **«ΑΝΟΙΧΤΟ ΤΩΡΑ · ΚΛΕΙΝΕΙ ΣΤΙΣ 21:00»** — και το ωράριο της εβδομάδας (ADR-841 §7 Α21.16 · Α21.16.8).
 * @related lib/calendar/weekly-hours.ts (`openStateAt`) · lib/calendar/greek-public-holidays.ts
 * @module components/mandate/ShowcaseOpeningHours
 *
 * 🏆 **Ό,τι κάνει η Google στο Business Profile και ΚΑΜΙΑ πλατφόρμα ακινήτων** — με δύο προσθήκες:
 *   • η ώρα είναι **ώρα Ελλάδας**, όχι του φυλλομετρητή (ο επισκέπτης από το Λονδίνο ρωτά για
 *     γραφείο στη Θεσσαλονίκη)·
 *   • σε **αργία** λέει *«το ωράριο ίσως διαφέρει»* — ποτέ ψευδές «ανοιχτό», ποτέ εικαζόμενο «κλειστό».
 *
 * Α21.16.8 — όπως η Google: «Κλείνει σύντομα» / «Ανοίγει σύντομα» (`SOON_MINUTES`), «Ανοιχτό 24 ώρες»,
 * και βάρδια μετά τα μεσάνυχτα που λέει «κλείνει **αύριο** στις 02:00» (CLDR, χωρίς κλειδί).
 *
 * ♿ **Το κανάλι κατάστασης είναι ΚΕΙΜΕΝΟ** (CHECK 3.41): «Ανοιχτό»/«Κλειστό» διαβάζονται χωρίς
 * χρώμα. Η εβδομάδα ζει σε `<details>` — ανοίγει με πληκτρολόγιο, χωρίς JavaScript.
 */

import React from 'react';
import { Clock } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatIsoWeekday, formatWeekdayFromToday } from '@/lib/intl-formatting';
import {
  athensClockAt,
  isAllDay,
  isSoon,
  ISO_WEEKDAYS,
  openStateAt,
  type DailyInterval,
  type OpenState,
  type WeeklyHours,
} from '@/lib/calendar/weekly-hours';
import { AGENCY_PUBLIC_NS, PROFILE_HOLIDAY_KEYS, PROFILE_KEYS } from './agency-directory-labels';

type Translate = ReturnType<typeof useTranslation>['t'];

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

function dayText(intervals: readonly DailyInterval[], t: Translate): string {
  if (intervals.length === 0) return t(PROFILE_KEYS.cardClosedDay);
  return intervals
    .map((interval) => (isAllDay(interval) ? t(PROFILE_KEYS.cardOpenAllDay) : `${interval.opens}–${interval.closes}`))
    .join(', ');
}

export function ShowcaseOpeningHours({ hours }: { readonly hours: WeeklyHours }): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const now = useMinuteClock();
  const today = athensClockAt(now).weekday;

  return (
    <section className="flex flex-col gap-1">
      <p className="m-0 flex items-center gap-2 text-sm font-medium text-foreground">
        <Clock aria-hidden="true" className="h-4 w-4" /> {openStateText(openStateAt(hours, now), t)}
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">{t(PROFILE_KEYS.cardHoursTitle)}</summary>
        <table className="mt-2 border-collapse text-sm">
          <tbody>
            {ISO_WEEKDAYS.map((weekday) => (
              <tr key={weekday} className={weekday === today ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                <th scope="row" className="pr-4 text-left font-[inherit]">
                  {formatIsoWeekday(weekday)}
                  {weekday === today ? <span className="sr-only"> ({t(PROFILE_KEYS.cardToday)})</span> : null}
                </th>
                <td>{dayText(hours[weekday], t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
