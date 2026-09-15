'use client';

/**
 * @fileoverview **ΤΟ ΩΡΑΡΙΟ, ΗΜΕΡΑ-ΗΜΕΡΑ** — σπαστά διαστήματα, 24 ώρες, μετά τα μεσάνυχτα, πρότυπα (ADR-841 §7 Α21.16 · Α21.16.8).
 * @related lib/calendar/weekly-hours.ts (ο ΕΝΑΣ κριτής) · lib/calendar/weekly-hours-editing.ts · WeeklyHoursDayRow.tsx
 * @module components/mandate/WeeklyHoursField
 *
 * 🔑 `<input type="time">` και όχι ελεύθερο κείμενο: ο φυλλομετρητής δίνει **ήδη** `HH:mm`, με
 * πληκτρολόγιο ώρας στο κινητό — ο κριτής μένει ως **δεύτερη ζώνη** για ό,τι δεν ήρθε από εδώ.
 *
 * 🔑 **Τα ελαττώματα ανά ημέρα από τον ΙΔΙΟ κριτή** (`weeklyHoursDefects`) που τρέχει ο διακομιστής —
 * εδώ η ανάδραση, εκεί η εγγύηση· κανένα δεύτερο prop που μπορεί να διαφωνήσει με τις ώρες.
 */

import React from 'react';
import { CalendarClock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ISO_WEEKDAYS, weeklyHoursDefects, type WeeklyHours } from '@/lib/calendar/weekly-hours';
import {
  copyDayTo,
  WEEKLY_HOURS_PRESET_IDS,
  WEEKLY_HOURS_PRESETS,
  type WeeklyHoursPreset,
} from '@/lib/calendar/weekly-hours-editing';
import { SHOWCASE_CARD_KEYS, SHOWCASE_CARD_PRESET_KEYS, SHOWCASE_NS } from '@/components/mandate/agency-showcase-labels';
import { WeeklyHoursDayRow } from './WeeklyHoursDayRow';

interface WeeklyHoursFieldProps {
  readonly hours: WeeklyHours;
  readonly onChange: (hours: WeeklyHours) => void;
}

function PresetMenu({ onPreset }: { readonly onPreset: (preset: WeeklyHoursPreset) => void }): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="self-start">
          <CalendarClock aria-hidden="true" /> {t(SHOWCASE_CARD_KEYS.presets)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {WEEKLY_HOURS_PRESET_IDS.map((preset) => (
          <DropdownMenuItem key={preset} onSelect={() => onPreset(preset)}>{t(SHOWCASE_CARD_PRESET_KEYS[preset])}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WeeklyHoursField({ hours, onChange }: WeeklyHoursFieldProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const defects = React.useMemo(
    () => new Map(weeklyHoursDefects(hours).map(({ weekday, defect }) => [weekday, defect])),
    [hours],
  );

  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="text-sm font-medium text-foreground">{t(SHOWCASE_CARD_KEYS.hoursLabel)}</legend>
      <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_CARD_KEYS.hoursHint)}</p>
      <PresetMenu onPreset={(preset) => onChange(WEEKLY_HOURS_PRESETS[preset])} />
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {ISO_WEEKDAYS.map((weekday) => (
          <WeeklyHoursDayRow
            key={weekday}
            weekday={weekday}
            intervals={hours[weekday]}
            defect={defects.get(weekday) ?? null}
            onDay={(day) => onChange({ ...hours, [weekday]: day })}
            onCopy={(group) => onChange(copyDayTo(hours, weekday, group))}
          />
        ))}
      </ul>
    </fieldset>
  );
}
