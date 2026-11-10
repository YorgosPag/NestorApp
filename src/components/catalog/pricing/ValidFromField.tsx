'use client';

/**
 * @fileoverview **Το «ισχύει από» μιας έκδοσης τιμών** — ΕΝΑ πεδίο για τη νέα έκδοση, την πρόχειρη και τη δημοσίευση
 *   (ADR-923 §5.11 «3δ»).
 * @related version-timeline.ts (`publishableStart` — ο ΙΔΙΟΣ κανόνας με τον κριτή της δημοσίευσης)
 * @module components/catalog/pricing/ValidFromField
 *
 * 🔑 Ο άνθρωπος **δεν ψάχνει** την ημερομηνία: η υπόδειξη λέει τη **νωρίτερη** ημέρα με όνομα («μετά την Έκδοση 3»), οι
 *    ημέρες που δεν περνούν τη δημοσίευση **δεν διαλέγονται** στο ημερολόγιο, και οι γρήγορες επιλογές που θα αποτύχουν
 *    είναι ανενεργές — καλύτερα να μη διαλέγεται μια άκυρη μέρα παρά να κοκκινίζει μετά (ADR-841 §7 Α21.21).
 */

import React from 'react';

import { ToggleButton } from '@/components/ui/toggle-button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { addDaysToDateKey, addMonthsToDateKey, instantOfDateKey } from '@/lib/calendar/date-key';
import { localDateOf } from '@/lib/date-local';
import { formatDate } from '@/lib/intl-formatting';
import type { PublishableStart } from '@/subapps/catalog/pricing/version-timeline';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';

export interface ValidFromFieldProps {
  /** Η τρέχουσα τιμή (αρχή ημέρας, ISO) — `null` = χωρίς ημερομηνία. */
  readonly value: string | null;
  readonly onChange: (validFrom: string | null) => void;
  readonly start: PublishableStart;
  readonly nowMs: number;
  /** Προσφέρεται «Χωρίς ημερομηνία» (πρόχειρη) — όχι στη δημοσίευση, όπου η ημερομηνία είναι υποχρεωτική. */
  readonly allowNone: boolean;
  readonly disabled?: boolean;
  /** Πρόταση πριν από τον κανόνα (π.χ. «η νέα έκδοση κόβει την προηγούμενη»). */
  readonly lead?: string;
}

type QuickKey = 'quickToday' | 'quickTomorrow' | 'quickNextMonth';

const QUICK_LABEL_KEYS: Readonly<Record<QuickKey, string>> = {
  quickToday: 'pricing.versions.quickToday',
  quickTomorrow: 'pricing.versions.quickTomorrow',
  quickNextMonth: 'pricing.versions.quickNextMonth',
};

/** Σήμερα · αύριο · 1η του επόμενου μήνα — αρχές ημέρας στην τοπική ώρα του ανθρώπου. */
export function quickValidFromChoices(nowMs: number): readonly { readonly key: QuickKey; readonly value: string | null }[] {
  const today = localDateOf(new Date(nowMs));
  return [
    { key: 'quickToday', value: instantOfDateKey(today) },
    { key: 'quickTomorrow', value: instantOfDateKey(addDaysToDateKey(today, 1)) },
    { key: 'quickNextMonth', value: instantOfDateKey(addMonthsToDateKey(`${today.slice(0, 8)}01`, 1)) },
  ];
}

const isBefore = (value: string, earliest: string | null): boolean => earliest !== null && Date.parse(value) < Date.parse(earliest);

function useRuleHint(start: PublishableStart, lead: string | undefined): string {
  const { t } = useCatalogText();
  const rule = start.earliest !== null && start.after !== null
    ? t('pricing.versions.validFromEarliest', { date: formatDate(new Date(start.earliest)), number: start.after })
    : t('pricing.versions.validFromFirst');
  return lead ? `${lead} ${rule}` : rule;
}

function QuickChoices({ value, onChange, start, nowMs, allowNone, disabled }: ValidFromFieldProps) {
  const { t } = useCatalogText();
  const choices = quickValidFromChoices(nowMs).filter((choice): choice is { key: QuickKey; value: string } => choice.value !== null);
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1 p-0" aria-label={t('pricing.versions.quickLabel')}>
      {choices.map((choice) => (
        <li key={choice.key}>
          <ToggleButton type="button" size="sm" variant="outline" pressed={value === choice.value}
            disabled={disabled || isBefore(choice.value, start.earliest)} onClick={() => onChange(choice.value)}>
            {t(QUICK_LABEL_KEYS[choice.key])}
          </ToggleButton>
        </li>
      ))}
      {allowNone ? (
        <li>
          <ToggleButton type="button" size="sm" variant="outline" pressed={value === null} disabled={disabled} onClick={() => onChange(null)}>
            {t('pricing.versions.validFromNone')}
          </ToggleButton>
        </li>
      ) : null}
    </ul>
  );
}

export function ValidFromField(props: ValidFromFieldProps) {
  const { t } = useCatalogText();
  const { value, onChange, start, disabled } = props;
  const hint = useRuleHint(start, props.lead);
  return (
    <CatalogField label={t('pricing.versions.validFrom')} hint={hint}>
      {({ id, describedBy }) => (
        <section className="flex flex-col gap-2" aria-describedby={describedBy}>
          <DatePickerField id={id} value={value === null ? undefined : new Date(value)} disabled={disabled} placeholder={t('pricing.versions.validFromNone')}
            disabledDates={start.earliest === null ? undefined : { before: new Date(start.earliest) }}
            onSelect={(date) => onChange(date ? date.toISOString() : null)} />
          <QuickChoices {...props} />
        </section>
      )}
    </CatalogField>
  );
}
