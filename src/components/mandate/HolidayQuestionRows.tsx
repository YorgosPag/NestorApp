'use client';

/**
 * @fileoverview **ΟΙ ΜΕΡΕΣ ΠΟΥ ΠΕΡΙΜΕΝΟΥΝ ΑΠΑΝΤΗΣΗ** — ανά κατάστημα × ημερομηνία (ADR-841 §7 Α21.21 Φάση Β).
 * @related components/mandate/HolidayQuestionContent.tsx · SpecialDayRow.tsx (η φόρμα) · services/mandate/holiday-hours-question-decision.ts
 * @module components/mandate/HolidayQuestionRows
 *
 * 🔑 **Μία ομάδα επιλογής, δύο χρήσεις**: η ίδια `HolidayKindChoice` είναι η γραμμή μιας μέρας **και** το «Ίδιο για όλες» —
 * ίδια λέξη, ίδια σειρά, ίδιο πληκτρολόγιο (Radix: βέλη μέσα στην ομάδα, Tab ανάμεσα σε ομάδες).
 * ⚠️ Επικεφαλίδα καταστήματος **μόνο** όταν είναι πάνω από ένα: ένα γραφείο με μία έδρα δεν χρειάζεται να διαβάσει «Έδρα».
 */

import React from 'react';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { HOLIDAY_ANSWER_KINDS, type HolidayAnswerKind } from '@/lib/calendar/holiday-question';
import { formatCalendarDay } from '@/lib/intl-formatting';
import type { HolidayQuestionRow } from '@/services/mandate/holiday-hours-question-decision';

import { PROFILE_HOLIDAY_KEYS, PROFILE_ROLE_KEYS } from './agency-directory-labels';
import { SHOWCASE_SPECIAL_KIND_KEYS } from './agency-showcase-special-hours-labels';
import { HOLIDAY_QUESTION_KEYS, HOLIDAY_QUESTION_NS } from './holiday-question-labels';

/** Επιλογή ανά γραμμή — κλειδί `holidayRowKey`. */
export type HolidayChoices = Readonly<Record<string, HolidayAnswerKind>>;

export function holidayRowKey(row: Pick<HolidayQuestionRow, 'locationId' | 'date'>): string {
  return `${row.locationId}|${row.date}`;
}

function kindOf(value: string): HolidayAnswerKind | null {
  return HOLIDAY_ANSWER_KINDS.find((kind) => kind === value) ?? null;
}

export function HolidayKindChoice({ value, labelledBy, disabled, onChange }: {
  readonly value: HolidayAnswerKind | null;
  readonly labelledBy: string;
  readonly disabled: boolean;
  readonly onChange: (kind: HolidayAnswerKind) => void;
}): React.ReactElement {
  const { t } = useTranslation([HOLIDAY_QUESTION_NS]);
  const id = React.useId();
  const pick = (next: string) => {
    const kind = kindOf(next);
    if (kind !== null) onChange(kind);
  };
  return (
    <RadioGroup aria-labelledby={labelledBy} value={value ?? ''} disabled={disabled} onValueChange={pick} className="flex flex-wrap gap-4">
      {HOLIDAY_ANSWER_KINDS.map((kind) => (
        <label key={kind} htmlFor={`${id}-${kind}`} className="flex items-center gap-2 text-sm text-card-foreground">
          <RadioGroupItem id={`${id}-${kind}`} value={kind} />
          {t(SHOWCASE_SPECIAL_KIND_KEYS[kind])}
        </label>
      ))}
    </RadioGroup>
  );
}

function DateRow({ row, choice, disabled, onChoose }: {
  readonly row: HolidayQuestionRow;
  readonly choice: HolidayAnswerKind | null;
  readonly disabled: boolean;
  readonly onChoose: (row: HolidayQuestionRow, kind: HolidayAnswerKind) => void;
}): React.ReactElement {
  const { t } = useTranslation([HOLIDAY_QUESTION_NS]);
  const labelId = React.useId();
  return (
    <li className="flex flex-col gap-2">
      <p id={labelId} className="m-0 flex flex-col text-sm">
        <span className="font-medium text-card-foreground">{t(PROFILE_HOLIDAY_KEYS[row.holiday])}</span>
        <span className="text-muted-foreground">{formatCalendarDay(row.date, true)}</span>
      </p>
      <HolidayKindChoice value={choice} labelledBy={labelId} disabled={disabled} onChange={(kind) => onChoose(row, kind)} />
      {row.lastYear !== null ? (
        <p className="m-0 text-xs text-muted-foreground">
          {t(HOLIDAY_QUESTION_KEYS.lastYear, { answer: t(SHOWCASE_SPECIAL_KIND_KEYS[row.lastYear]) })}
        </p>
      ) : null}
    </li>
  );
}

interface LocationGroup {
  readonly locationId: string;
  readonly label: string | null;
  readonly role: HolidayQuestionRow['locationRole'];
  readonly rows: readonly HolidayQuestionRow[];
}

function groupsOf(rows: readonly HolidayQuestionRow[]): LocationGroup[] {
  const groups = new Map<string, LocationGroup>();
  for (const row of rows) {
    const group = groups.get(row.locationId);
    groups.set(row.locationId, group
      ? { ...group, rows: [...group.rows, row] }
      : { locationId: row.locationId, label: row.locationLabel, role: row.locationRole, rows: [row] });
  }
  return [...groups.values()];
}

export function HolidayQuestionRows({ rows, choices, disabled, onChoose }: {
  readonly rows: readonly HolidayQuestionRow[];
  readonly choices: HolidayChoices;
  readonly disabled: boolean;
  readonly onChoose: (row: HolidayQuestionRow, kind: HolidayAnswerKind) => void;
}): React.ReactElement {
  const { t } = useTranslation([HOLIDAY_QUESTION_NS]);
  const groups = groupsOf(rows);
  const titled = groups.length > 1;
  return (
    <>
      {groups.map((group) => (
        <section key={group.locationId} className="flex flex-col gap-3">
          {titled ? (
            <h2 className="m-0 text-sm font-semibold text-card-foreground">{group.label ?? t(PROFILE_ROLE_KEYS[group.role])}</h2>
          ) : null}
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {group.rows.map((row) => (
              <DateRow key={holidayRowKey(row)} row={row} choice={choices[holidayRowKey(row)] ?? null} disabled={disabled} onChoose={onChoose} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
