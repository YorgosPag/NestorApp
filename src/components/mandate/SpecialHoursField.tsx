'use client';

/**
 * @fileoverview 🏆 **ΕΙΔΙΚΕΣ ΩΡΕΣ** — αργίες, άδειες, πολιούχος: ωράριο ανά ημερομηνία (ADR-841 §7 Α21.21).
 * @related lib/calendar/special-hours.ts (ο ΕΝΑΣ κριτής) · lib/calendar/hours-timeline.ts (`holidaysNeedingAnswer`) ·
 *   SpecialDayRow.tsx · ShowcaseLocationEditor.tsx
 * @module components/mandate/SpecialHoursField
 *
 * 🏆 **Google Business Profile**: «Special hours» με προτεινόμενες αργίες («Review»). **Τι προσθέτουμε**:
 *   • προτείνονται **μόνο** αργίες σε μέρα που **είστε ανοιχτά** και **χωρίς** δήλωση — ο **ίδιος** κριτής που γράφει
 *     «ίσως διαφέρει» στη δημόσια σελίδα· ό,τι απαντήθηκε δεν ξαναπροτείνεται·
 *   • η Πρωτομαγιά χρονιάς με κίνδυνο μετάθεσης λέει «μπορεί να μετατεθεί» — ποτέ βεβαιότητα για λάθος μέρα·
 *   • «Προσθήκη ημερομηνίας» προτείνει **πάντα έγκυρη** μέρα (`proposeSpecialDay`) — ποτέ κόκκινο από το ίδιο το κουμπί.
 *
 * 🔑 Οι **περασμένες** μέρες δεν δείχνονται (ο διακομιστής τις κλαδεύει στην αποθήκευση) — ίδιο με τη Google.
 */

import React from 'react';
import { CalendarPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import { isDateKey } from '@/lib/calendar/date-key';
import { greekPublicHolidayOn } from '@/lib/calendar/greek-public-holidays';
import { holidaysNeedingAnswer, type HolidayQuestion } from '@/lib/calendar/hours-timeline';
import { proposeSpecialDay, specialDaysDefects, type SpecialDay } from '@/lib/calendar/special-hours';
import { athensClockAt, type WeeklyHours } from '@/lib/calendar/weekly-hours';
import { PROFILE_HOLIDAY_KEYS } from './agency-directory-labels';
import { SHOWCASE_NS } from './agency-showcase-labels';
import { SHOWCASE_SPECIAL_HOURS_KEYS } from './agency-showcase-special-hours-labels';
import { SpecialDayRow } from './SpecialDayRow';

interface SpecialHoursFieldProps {
  readonly hours: WeeklyHours;
  readonly special: readonly SpecialDay[];
  readonly onChange: (special: readonly SpecialDay[]) => void;
}

function HolidaySuggestions({ questions, onPick }: {
  readonly questions: readonly HolidayQuestion[];
  readonly onPick: (dateKey: string) => void;
}): React.ReactElement | null {
  const { t } = useTranslation([SHOWCASE_NS]);
  const headingId = React.useId();
  if (questions.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h4 id={headingId} className="m-0 text-sm font-medium text-foreground">{t(SHOWCASE_SPECIAL_HOURS_KEYS.suggested)}</h4>
      <p className="m-0 text-xs text-muted-foreground">{t(SHOWCASE_SPECIAL_HOURS_KEYS.suggestedHint)}</p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {questions.map(({ dateKey, holiday, provisional }) => (
          <li key={dateKey}>
            <Button type="button" variant="outline" size="sm" onClick={() => onPick(dateKey)}>
              {t(SHOWCASE_SPECIAL_HOURS_KEYS.suggestion, { holiday: t(PROFILE_HOLIDAY_KEYS[holiday]), date: formatCalendarDay(dateKey, true) })}
              {provisional ? <span className="text-xs text-muted-foreground"> ({t(SHOWCASE_SPECIAL_HOURS_KEYS.provisional)})</span> : null}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SpecialHoursField({ hours, special, onChange }: SpecialHoursFieldProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const [now] = React.useState(() => new Date());
  const todayKey = athensClockAt(now).dateKey;
  const defects = React.useMemo(
    () => new Map(specialDaysDefects(special, todayKey).map(({ index, defect }) => [index, defect])),
    [special, todayKey],
  );
  const questions = React.useMemo(() => holidaysNeedingAnswer(hours, now, { special }), [hours, now, special]);
  const proposal = proposeSpecialDay(special, todayKey);
  const edit = (index: number, day: SpecialDay) => onChange(special.map((current, at) => (at === index ? day : current)));

  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="text-sm font-medium text-foreground">{t(SHOWCASE_SPECIAL_HOURS_KEYS.title)}</legend>
      <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_SPECIAL_HOURS_KEYS.hint)}</p>
      <HolidaySuggestions questions={questions} onPick={(date) => onChange([...special, { date, kind: 'closed' }])} />
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {special.map((day, index) => (isDateKey(day.date) && day.date < todayKey ? null : (
          <SpecialDayRow
            key={index}
            day={day}
            hours={hours}
            holiday={greekPublicHolidayOn(day.date)}
            defect={defects.get(index) ?? null}
            todayKey={todayKey}
            onChange={(next) => edit(index, next)}
            onRemove={() => onChange(special.filter((_, at) => at !== index))}
          />
        )))}
      </ul>
      {proposal !== null ? (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...special, proposal])}>
          <CalendarPlus aria-hidden="true" /> {t(SHOWCASE_SPECIAL_HOURS_KEYS.add)}
        </Button>
      ) : null}
    </fieldset>
  );
}
