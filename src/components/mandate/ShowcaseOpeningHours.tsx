'use client';

/**
 * @fileoverview 🏆 **«ΑΝΟΙΧΤΟ ΤΩΡΑ · ΚΛΕΙΝΕΙ ΣΤΙΣ 21:00»** — και το ωράριο της εβδομάδας (ADR-841 §7 Α21.16).
 * @related lib/calendar/weekly-hours.ts (`openStateAt`) · lib/calendar/greek-public-holidays.ts
 * @module components/mandate/ShowcaseOpeningHours
 *
 * 🏆 **Ό,τι κάνει η Google στο Business Profile και ΚΑΜΙΑ πλατφόρμα ακινήτων** — με δύο προσθήκες:
 *   • η ώρα είναι **ώρα Ελλάδας**, όχι του φυλλομετρητή (ο επισκέπτης από το Λονδίνο ρωτά για
 *     γραφείο στη Θεσσαλονίκη)·
 *   • σε **αργία** λέει *«το ωράριο ίσως διαφέρει»* — ποτέ ψευδές «ανοιχτό», ποτέ εικαζόμενο «κλειστό».
 *
 * ♿ **Το κανάλι κατάστασης είναι ΚΕΙΜΕΝΟ** (CHECK 3.41): «Ανοιχτό»/«Κλειστό» διαβάζονται χωρίς
 * χρώμα. Η εβδομάδα ζει σε `<details>` — ανοίγει με πληκτρολόγιο, χωρίς JavaScript.
 */

import React from 'react';
import { Clock } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatIsoWeekday } from '@/lib/intl-formatting';
import {
  athensClockAt,
  ISO_WEEKDAYS,
  openStateAt,
  type OpenState,
  type WeeklyHours,
} from '@/lib/calendar/weekly-hours';
import { AGENCY_PUBLIC_NS, PROFILE_HOLIDAY_KEYS, PROFILE_KEYS } from './agency-directory-labels';

/** Ανανέωση ανά λεπτό — το «κλείνει σε λίγο» δεν επιτρέπεται να μείνει αληθινό μετά το κλείσιμο. */
function useMinuteClock(): Date {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function OpenStateLine({ state }: { readonly state: OpenState }): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  let text: string;
  if (state.kind === 'open') {
    text = t(PROFILE_KEYS.cardOpenNow, { time: state.closes });
  } else if (state.kind === 'holiday') {
    text = t(PROFILE_KEYS.cardHoliday, { holiday: t(PROFILE_HOLIDAY_KEYS[state.holiday]) });
  } else if (state.next === null) {
    text = t(PROFILE_KEYS.cardClosedWeek);
  } else if (state.next.inDays === 0) {
    text = t(PROFILE_KEYS.cardOpensToday, { time: state.next.opens });
  } else {
    text = t(PROFILE_KEYS.cardOpensLater, { day: formatIsoWeekday(state.next.weekday), time: state.next.opens });
  }
  return (
    <p className="m-0 flex items-center gap-2 text-sm font-medium text-foreground">
      <Clock aria-hidden="true" className="h-4 w-4" /> {text}
    </p>
  );
}

export function ShowcaseOpeningHours({ hours }: { readonly hours: WeeklyHours }): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const now = useMinuteClock();
  const today = athensClockAt(now).weekday;

  return (
    <section className="flex flex-col gap-1">
      <OpenStateLine state={openStateAt(hours, now)} />
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
                <td>
                  {hours[weekday].length === 0
                    ? t(PROFILE_KEYS.cardClosedDay)
                    : hours[weekday].map(({ opens, closes }) => `${opens}–${closes}`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
