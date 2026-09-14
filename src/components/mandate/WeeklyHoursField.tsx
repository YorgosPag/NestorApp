'use client';

/**
 * @fileoverview **ΤΟ ΩΡΑΡΙΟ, ΗΜΕΡΑ-ΗΜΕΡΑ** — με σπαστά διαστήματα (ADR-841 §7 Α21.16).
 * @related lib/calendar/weekly-hours.ts (ο ΕΝΑΣ κριτής)
 * @module components/mandate/WeeklyHoursField
 *
 * 🔑 `<input type="time">` και όχι ελεύθερο κείμενο: ο φυλλομετρητής δίνει **ήδη** `HH:mm`, με
 * πληκτρολόγιο ώρας στο κινητό — ο κριτής μένει ως **δεύτερη ζώνη** για ό,τι δεν ήρθε από εδώ.
 */

import React from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatIsoWeekday } from '@/lib/intl-formatting';
import {
  ISO_WEEKDAYS,
  MAX_INTERVALS_PER_DAY,
  type DailyInterval,
  type IsoWeekday,
  type WeeklyHours,
  type WeeklyHoursDefect,
} from '@/lib/calendar/weekly-hours';
import {
  SHOWCASE_CARD_HOURS_DEFECT_KEYS,
  SHOWCASE_CARD_KEYS,
  SHOWCASE_NS,
} from '@/components/mandate/agency-showcase-labels';

interface WeeklyHoursFieldProps {
  readonly hours: WeeklyHours;
  readonly defect: WeeklyHoursDefect | null;
  readonly onChange: (hours: WeeklyHours) => void;
}

/** Νέο διάστημα: αμέσως μετά το τελευταίο — ποτέ επικαλυπτόμενο από την ίδια την πρόταση. */
function nextInterval(day: readonly DailyInterval[]): DailyInterval {
  const last = day[day.length - 1];
  return last === undefined ? { opens: '09:00', closes: '17:00' } : { opens: last.closes, closes: last.closes };
}

function DayRow({
  weekday,
  intervals,
  onDay,
}: {
  readonly weekday: IsoWeekday;
  readonly intervals: readonly DailyInterval[];
  readonly onDay: (intervals: readonly DailyInterval[]) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const edit = (index: number, patch: Partial<DailyInterval>) =>
    onDay(intervals.map((interval, at) => (at === index ? { ...interval, ...patch } : interval)));

  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="w-28 text-sm font-medium text-foreground">{formatIsoWeekday(weekday)}</span>
      {intervals.length === 0 ? <span className="text-sm text-muted-foreground">{t(SHOWCASE_CARD_KEYS.dayClosed)}</span> : null}
      {intervals.map((interval, index) => (
        <span key={index} className="flex items-center gap-1">
          <Input type="time" className="w-28" aria-label={t(SHOWCASE_CARD_KEYS.opensLabel)} value={interval.opens} onChange={(event) => edit(index, { opens: event.target.value })} />
          <Input type="time" className="w-28" aria-label={t(SHOWCASE_CARD_KEYS.closesLabel)} value={interval.closes} onChange={(event) => edit(index, { closes: event.target.value })} />
          <Button type="button" variant="ghost" size="icon" aria-label={t(SHOWCASE_CARD_KEYS.removeInterval)} onClick={() => onDay(intervals.filter((_, at) => at !== index))}>
            <X aria-hidden="true" />
          </Button>
        </span>
      ))}
      {intervals.length < MAX_INTERVALS_PER_DAY ? (
        <Button type="button" variant="ghost" size="icon" aria-label={t(SHOWCASE_CARD_KEYS.addInterval)} onClick={() => onDay([...intervals, nextInterval(intervals)])}>
          <Plus aria-hidden="true" />
        </Button>
      ) : null}
    </li>
  );
}

export function WeeklyHoursField({ hours, defect, onChange }: WeeklyHoursFieldProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="text-sm font-medium text-foreground">{t(SHOWCASE_CARD_KEYS.hoursLabel)}</legend>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {ISO_WEEKDAYS.map((weekday) => (
          <DayRow key={weekday} weekday={weekday} intervals={hours[weekday]} onDay={(day) => onChange({ ...hours, [weekday]: day })} />
        ))}
      </ul>
      {defect !== null ? (
        <p role="alert" className="m-0 text-sm text-destructive">
          {t(SHOWCASE_CARD_HOURS_DEFECT_KEYS[defect], { max: MAX_INTERVALS_PER_DAY })}
        </p>
      ) : null}
    </fieldset>
  );
}
