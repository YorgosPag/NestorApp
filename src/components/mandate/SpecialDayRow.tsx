'use client';

/**
 * @fileoverview **ΜΙΑ ΕΙΔΙΚΗ ΜΕΡΑ** — ημερομηνία · Κλειστά / Κανονικό ωράριο / Άλλο ωράριο · διαστήματα (ADR-841 §7 Α21.21).
 * @related SpecialHoursField.tsx · DailyIntervalsEditor.tsx · components/ui/date-picker-field.tsx · lib/calendar/special-hours.ts
 * @module components/mandate/SpecialDayRow
 *
 * 🔑 **Η ημερομηνία από τα ΤΟΠΙΚΑ μέρη** (`localDateOf`): ο επιλογέας δίνει τοπικά μεσάνυχτα, και το `toISOString()`
 * θα έγραφε την **προηγούμενη** μέρα σε κάθε ζώνη ανατολικά του UTC — δηλαδή σε όλη την Ελλάδα.
 *
 * 🔑 **Παρελθόν και πέρα από τον ορίζοντα δεν επιλέγονται καν** — καλύτερα απενεργοποιημένη μέρα παρά κόκκινο μήνυμα.
 *
 * 🔑 **Μνήμη** (ίδιο με Α21.16.8): «Κλειστά» κατά λάθος και πίσω σε «Άλλο ωράριο» ⇒ οι ώρες επιστρέφουν· η πρώτη
 * πρόταση είναι οι **εβδομαδιαίες** ώρες εκείνης της ημέρας («κλείνουμε νωρίτερα» = αλλάζω ένα πεδίο, όχι τρία).
 */

import React from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { localDateOf } from '@/lib/date-local';
import { formatCalendarDay } from '@/lib/intl-formatting';
import { addDaysToDateKey, calendarDateOfDateKey, isDateKey, isoWeekdayOfDateKey } from '@/lib/calendar/date-key';
import type { GreekPublicHolidayId } from '@/lib/calendar/greek-public-holidays';
import {
  MAX_SPECIAL_DAYS_PER_LOCATION,
  SPECIAL_DAY_KINDS,
  SPECIAL_DAYS_HORIZON_DAYS,
  type SpecialDay,
  type SpecialDayDefect,
  type SpecialDayKind,
} from '@/lib/calendar/special-hours';
import { MAX_INTERVALS_PER_DAY, type DailyInterval, type WeeklyHours } from '@/lib/calendar/weekly-hours';
import { DEFAULT_INTERVAL } from '@/lib/calendar/weekly-hours-editing';
import { PROFILE_HOLIDAY_KEYS } from './agency-directory-labels';
import { SHOWCASE_NS } from './agency-showcase-labels';
import {
  SHOWCASE_SPECIAL_DEFECT_KEYS,
  SHOWCASE_SPECIAL_HOURS_KEYS,
  SHOWCASE_SPECIAL_KIND_KEYS,
} from './agency-showcase-special-hours-labels';
import { DailyIntervalsEditor } from './DailyIntervalsEditor';

export interface SpecialDayRowProps {
  readonly day: SpecialDay;
  readonly hours: WeeklyHours;
  readonly holiday: GreekPublicHolidayId | null;
  readonly defect: SpecialDayDefect | null;
  readonly todayKey: string;
  readonly onChange: (day: SpecialDay) => void;
  readonly onRemove: () => void;
}

const isKind = (value: string): value is SpecialDayKind => (SPECIAL_DAY_KINDS as readonly string[]).includes(value);

function dayOfKind(kind: SpecialDayKind, date: string, remembered: readonly DailyInterval[]): SpecialDay {
  return kind === 'custom' ? { date, kind, intervals: remembered } : { date, kind };
}

/** Αφετηρία του «Άλλο ωράριο»: ό,τι είχε η μέρα, αλλιώς το εβδομαδιαίο της, αλλιώς 09:00–17:00. */
function seedIntervals(day: SpecialDay, hours: WeeklyHours): readonly DailyInterval[] {
  if (day.kind === 'custom' && day.intervals.length > 0) return day.intervals;
  const weekday = isoWeekdayOfDateKey(day.date);
  const weekly = weekday === null ? [] : hours[weekday];
  return weekly.length > 0 ? weekly : [DEFAULT_INTERVAL];
}

function DateField({ date, todayKey, onDate }: {
  readonly date: string;
  readonly todayKey: string;
  readonly onDate: (date: string) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const bounds = React.useMemo(() => {
    const first = calendarDateOfDateKey(todayKey);
    const last = calendarDateOfDateKey(addDaysToDateKey(todayKey, SPECIAL_DAYS_HORIZON_DAYS) ?? todayKey);
    return first === null || last === null ? undefined : [{ before: first }, { after: last }];
  }, [todayKey]);
  return (
    <span className="w-60">
      <DatePickerField
        value={calendarDateOfDateKey(date) ?? undefined}
        onSelect={(picked) => { if (picked !== undefined) onDate(localDateOf(picked)); }}
        placeholder={t(SHOWCASE_SPECIAL_HOURS_KEYS.datePlaceholder)}
        disabledDates={bounds}
      />
    </span>
  );
}

function KindSelect({ kind, label, onKind }: {
  readonly kind: SpecialDayKind;
  readonly label: string;
  readonly onKind: (kind: SpecialDayKind) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  return (
    <Select value={kind} onValueChange={(value) => { if (isKind(value)) onKind(value); }}>
      <SelectTrigger className="w-44" aria-label={t(SHOWCASE_SPECIAL_HOURS_KEYS.kindLabel, { date: label })}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SPECIAL_DAY_KINDS.map((option) => (
          <SelectItem key={option} value={option}>{t(SHOWCASE_SPECIAL_KIND_KEYS[option])}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SpecialDayRow({ day, hours, holiday, defect, todayKey, onChange, onRemove }: SpecialDayRowProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const errorId = React.useId();
  const remembered = React.useRef(seedIntervals(day, hours));
  React.useEffect(() => {
    if (day.kind === 'custom' && day.intervals.length > 0) remembered.current = day.intervals;
  }, [day]);
  const label = isDateKey(day.date) ? formatCalendarDay(day.date, true) : t(SHOWCASE_SPECIAL_HOURS_KEYS.datePlaceholder);
  const describedBy = defect === null ? undefined : errorId;
  const max = defect === 'too-many-days' ? MAX_SPECIAL_DAYS_PER_LOCATION : MAX_INTERVALS_PER_DAY;

  return (
    <li className="flex flex-col gap-2 border-b border-border pb-2 last:border-b-0">
      <span className="flex flex-wrap items-center gap-2">
        <DateField date={day.date} todayKey={todayKey} onDate={(date) => onChange({ ...day, date })} />
        {holiday !== null ? <span className="text-sm text-muted-foreground">{t(PROFILE_HOLIDAY_KEYS[holiday])}</span> : null}
        <KindSelect kind={day.kind} label={label} onKind={(kind) => onChange(dayOfKind(kind, day.date, remembered.current))} />
        <Button type="button" variant="ghost" size="icon" aria-label={t(SHOWCASE_SPECIAL_HOURS_KEYS.remove)} onClick={onRemove}>
          <X aria-hidden="true" />
        </Button>
      </span>
      {day.kind === 'custom' ? (
        <DailyIntervalsEditor day={label} intervals={day.intervals} errorId={describedBy} onChange={(intervals) => onChange({ date: day.date, kind: 'custom', intervals })} />
      ) : null}
      {defect !== null ? (
        <p id={errorId} role="alert" className="m-0 text-sm text-destructive">{t(SHOWCASE_SPECIAL_DEFECT_KEYS[defect], { max })}</p>
      ) : null}
    </li>
  );
}
