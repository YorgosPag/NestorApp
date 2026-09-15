'use client';

/**
 * @fileoverview **ΜΙΑ ΗΜΕΡΑ ΤΟΥ ΩΡΑΡΙΟΥ** — Κλειστά / Ανοιχτά / 24 ώρες, σπαστά διαστήματα, αντιγραφή (ADR-841 §7 Α21.16.8).
 * @related lib/calendar/weekly-hours-editing.ts · components/mandate/WeeklyHoursField.tsx · DailyIntervalsEditor.tsx
 * @module components/mandate/WeeklyHoursDayRow
 *
 * 🔴 **Το εύρημα που γέννησε την Α21.16.8**: το σπαστό ωράριο υποστηριζόταν ήδη, αλλά πίσω από ένα
 * **εικονίδιο «+» χωρίς κείμενο** — και η πρότασή του (`opens = closes = τελευταίο κλείσιμο`) ήταν
 * **άκυρη εκ γενετής**, άρα το πάτημα έβγαζε αμέσως κόκκινο μήνυμα. Ο άνθρωπος δεν το βρήκε.
 * Τώρα: **ορατό κείμενο**, πρόταση **πάντα έγκυρη**, ελάττωμα **δίπλα στην ημέρα του**.
 *
 * Α21.21 — η λίστα διαστημάτων ζει πλέον στο `DailyIntervalsEditor`, κοινή με την ειδική μέρα.
 *
 * ♿ Το όνομα της ημέρας μπαίνει ως `sr-only` **μετά** το ορατό κείμενο (WCAG 2.5.3 label-in-name).
 */

import React from 'react';
import { Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatIsoWeekday } from '@/lib/intl-formatting';
import {
  MAX_INTERVALS_PER_DAY,
  type DailyInterval,
  type IsoWeekday,
  type WeeklyHoursDefect,
} from '@/lib/calendar/weekly-hours';
import {
  DAY_MODES,
  dayModeOf,
  intervalsForMode,
  WEEKDAY_GROUP_IDS,
  type DayMode,
  type WeekdayGroup,
} from '@/lib/calendar/weekly-hours-editing';
import {
  SHOWCASE_CARD_COPY_GROUP_KEYS,
  SHOWCASE_CARD_DAY_MODE_KEYS,
  SHOWCASE_CARD_HOURS_DEFECT_KEYS,
  SHOWCASE_CARD_KEYS,
  SHOWCASE_NS,
} from '@/components/mandate/agency-showcase-labels';
import { DailyIntervalsEditor } from './DailyIntervalsEditor';

export interface WeeklyHoursDayRowProps {
  readonly weekday: IsoWeekday;
  readonly intervals: readonly DailyInterval[];
  readonly defect: WeeklyHoursDefect | null;
  readonly onDay: (intervals: readonly DailyInterval[]) => void;
  readonly onCopy: (group: WeekdayGroup) => void;
}

const isDayMode = (value: string): value is DayMode => (DAY_MODES as readonly string[]).includes(value);

function DayModeSelect({ day, mode, onMode }: { readonly day: string; readonly mode: DayMode; readonly onMode: (mode: DayMode) => void }): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  return (
    <Select value={mode} onValueChange={(value) => { if (isDayMode(value)) onMode(value); }}>
      <SelectTrigger className="w-44" aria-label={t(SHOWCASE_CARD_KEYS.dayModeLabel, { day })}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DAY_MODES.map((option) => (
          <SelectItem key={option} value={option}>{t(SHOWCASE_CARD_DAY_MODE_KEYS[option])}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CopyDayMenu({ day, onCopy }: { readonly day: string; readonly onCopy: (group: WeekdayGroup) => void }): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <Copy aria-hidden="true" /> {t(SHOWCASE_CARD_KEYS.copyDay)}
          <span className="sr-only"> ({day})</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {WEEKDAY_GROUP_IDS.map((group) => (
          <DropdownMenuItem key={group} onSelect={() => onCopy(group)}>{t(SHOWCASE_CARD_COPY_GROUP_KEYS[group])}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WeeklyHoursDayRow({ weekday, intervals, defect, onDay, onCopy }: WeeklyHoursDayRowProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const errorId = React.useId();
  const remembered = React.useRef(intervals);
  React.useEffect(() => {
    if (dayModeOf(intervals) === 'open') remembered.current = intervals;
  }, [intervals]);
  const mode = dayModeOf(intervals);
  const day = formatIsoWeekday(weekday);
  const describedBy = defect === null ? undefined : errorId;

  return (
    <li className="flex flex-col gap-2 border-b border-border pb-2 last:border-b-0">
      <span className="flex flex-wrap items-center gap-2">
        <span className="w-24 text-sm font-medium text-foreground">{day}</span>
        <DayModeSelect day={day} mode={mode} onMode={(next) => onDay(intervalsForMode(next, remembered.current))} />
        <CopyDayMenu day={day} onCopy={onCopy} />
      </span>
      {mode === 'open' ? <DailyIntervalsEditor day={day} intervals={intervals} errorId={describedBy} onChange={onDay} className="sm:pl-28" /> : null}
      {defect !== null ? (
        <p id={errorId} role="alert" className="m-0 text-sm text-destructive">
          {t(SHOWCASE_CARD_HOURS_DEFECT_KEYS[defect], { max: MAX_INTERVALS_PER_DAY })}
        </p>
      ) : null}
    </li>
  );
}
