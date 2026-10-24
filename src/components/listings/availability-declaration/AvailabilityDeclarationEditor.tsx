'use client';

/**
 * **Ο επιλογέας της υπόσχεσης** — ακρίβεια (τρίμηνο / μήνας / ημέρα) + περίοδος + ζωντανή προεπισκόπηση (ADR-919 §11).
 *
 * @related lib/listings/availability-declaration-draft.ts · lib/listings/availability-phrase.ts
 *
 * 🔑 **Δ2 στην οθόνη**: η εταιρεία διαλέγει ακρίβεια, με προεπιλογή το τρίμηνο (idealista «3er trimestre 2027»). Ο
 * άνθρωπος δεν πληκτρολογεί ποτέ διάστημα· το χτίζει το `scheduledAvailability` από `{ precision, anchor }`.
 *
 * 🏆 **WYSIWYG**: κάτω από τον επιλογέα γράφεται **ακριβώς** η φράση που θα δει το κοινό, από τον **ίδιο** μορφοποιητή
 * με την κάρτα, τη σελίδα και το email. Καμία έκπληξη μετά τη δημοσίευση.
 */

import React from 'react';

import { DatePickerField } from '@/components/ui/date-picker-field';
import { Label } from '@/components/ui/label';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { dateKeyOfPicker, pickerDateOfKey } from '@/lib/calendar/date-key';
import { formatCalendarMonth } from '@/lib/intl-formatting';
import { getCurrentLocale } from '@/lib/intl-utils';
import {
  periodOfDraft,
  selectableYears,
  withPeriod,
  withPrecision,
  withYear,
  yearOfAnchor,
} from '@/lib/listings/availability-declaration-draft';
import { availabilityPromisePhrase, QUARTER_ORDINAL_KEYS, QUARTER_ORDINALS } from '@/lib/listings/availability-phrase';
import { scheduledAvailability } from '@/lib/listings/availability-window';
import { AVAILABILITY_PRECISIONS, type AvailabilityDeclaration } from '@/types/listing-availability';

const NS = ['building', 'common-shared'];
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const PRECISION_KEYS = {
  quarter: 'building:availabilityPromise.precision.quarter',
  month: 'building:availabilityPromise.precision.month',
  day: 'building:availabilityPromise.precision.day',
} as const;

interface EditorProps {
  readonly idPrefix: string;
  readonly draft: AvailabilityDeclaration;
  readonly onDraftChange: (draft: AvailabilityDeclaration) => void;
  readonly today: string;
  readonly disabled?: boolean;
}

function YearSelect({ idPrefix, draft, onDraftChange, today, disabled }: EditorProps) {
  const { t } = useTranslation(NS);
  return (
    <section className="flex min-w-24 flex-col gap-1">
      <Label htmlFor={`${idPrefix}-year`}>{t('building:availabilityPromise.year')}</Label>
      <Select value={String(yearOfAnchor(draft.anchor))} onValueChange={(year) => onDraftChange(withYear(draft, Number(year)))} disabled={disabled}>
        <SelectTrigger id={`${idPrefix}-year`}><SelectValue /></SelectTrigger>
        <SelectContent>
          {selectableYears(today, draft).map((year) => <SelectItem key={year} value={String(year)}>{String(year)}</SelectItem>)}
        </SelectContent>
      </Select>
    </section>
  );
}

function PeriodSelect({ idPrefix, draft, onDraftChange, disabled }: EditorProps) {
  const { t } = useTranslation(NS);
  const isQuarter = draft.precision === 'quarter';
  const locale = getCurrentLocale();
  const year = yearOfAnchor(draft.anchor);
  const options = isQuarter
    ? QUARTER_ORDINALS.map((quarter) => ({ value: Number(quarter), label: t(QUARTER_ORDINAL_KEYS[quarter]) }))
    : MONTHS.map((month) => ({ value: month, label: formatCalendarMonth(`${year}-${String(month).padStart(2, '0')}`, locale) }));
  return (
    <section className="flex min-w-32 flex-col gap-1">
      <Label htmlFor={`${idPrefix}-period`}>
        {t(isQuarter ? 'building:availabilityPromise.quarter' : 'building:availabilityPromise.month')}
      </Label>
      <Select value={String(periodOfDraft(draft))} onValueChange={(period) => onDraftChange(withPeriod(draft, Number(period)))} disabled={disabled}>
        <SelectTrigger id={`${idPrefix}-period`}><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </section>
  );
}

function DaySelect({ idPrefix, draft, onDraftChange, disabled }: EditorProps) {
  const { t } = useTranslation(NS);
  return (
    <section className="flex min-w-48 flex-col gap-1">
      <Label htmlFor={`${idPrefix}-day`}>{t('building:availabilityPromise.day')}</Label>
      <DatePickerField
        id={`${idPrefix}-day`}
        value={pickerDateOfKey(draft.anchor)}
        onSelect={(date) => {
          const key = dateKeyOfPicker(date);
          if (key !== null) onDraftChange({ precision: 'day', anchor: key });
        }}
        placeholder={t('building:availabilityPromise.pickDay')}
        disabled={disabled}
      />
    </section>
  );
}

/** Η φράση που θα δει το κοινό για το προσχέδιο — ή `null` αν η άγκυρα δεν είναι πραγματική ημέρα. */
export function useDraftPhrase(draft: AvailabilityDeclaration): string | null {
  const { t } = useTranslation(NS);
  const availability = scheduledAvailability(draft.precision, draft.anchor);
  return availability.kind === 'scheduled' ? availabilityPromisePhrase(availability, t, getCurrentLocale()) : null;
}

export function AvailabilityDeclarationEditor(props: EditorProps) {
  const { t } = useTranslation(NS);
  const { draft, onDraftChange, disabled } = props;
  const phrase = useDraftPhrase(draft);
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="sr-only">{t('building:availabilityPromise.precisionLabel')}</legend>
      <SegmentedControl
        value={draft.precision}
        onValueChange={(precision) => onDraftChange(withPrecision(draft, precision))}
        aria-label={t('building:availabilityPromise.precisionLabel')}
      >
        {AVAILABILITY_PRECISIONS.map((precision) => (
          <SegmentedControlItem key={precision} value={precision}>{t(PRECISION_KEYS[precision])}</SegmentedControlItem>
        ))}
      </SegmentedControl>
      <section className="flex flex-wrap items-end gap-2">
        {draft.precision === 'day' ? <DaySelect {...props} /> : <><YearSelect {...props} /><PeriodSelect {...props} /></>}
      </section>
      {phrase !== null && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t('building:availabilityPromise.preview', { promise: phrase })}
        </p>
      )}
    </fieldset>
  );
}
