'use client';

/**
 * @fileoverview Τα **πεδία** της νέας εισαγωγής (ADR-923 §5.5): επιλογή, αριθμός, και οι δύο ομάδες ανά μορφή αρχείου.
 * @module components/catalog/imports/NewImportFields
 */

import React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useImportText } from './import-text';
import type { NewImportForm } from './use-new-import';

export interface ImportChoice {
  readonly value: string;
  readonly label: string;
}

interface ChoiceFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly choices: readonly ImportChoice[];
  readonly onChange: (value: string) => void;
}

export function ChoiceField({ id, label, value, choices, onChange }: ChoiceFieldProps) {
  return (
    <p className="m-0 flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>{choices.map((choice) => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}</SelectContent>
      </Select>
    </p>
  );
}

function NumberField({ id, label, value, onChange }: { readonly id: string; readonly label: string; readonly value: number; readonly onChange: (value: number) => void }) {
  return (
    <p className="m-0 flex w-28 flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </p>
  );
}

interface RangeFieldsProps {
  readonly form: NewImportForm;
  readonly onChange: (patch: Partial<NewImportForm>) => void;
}

/** Το εύρος σελίδων ενός PDF: ένα κεφάλαιο, όχι ολόκληρος κατάλογος. */
export function PageRangeFields({ form, onChange }: RangeFieldsProps) {
  const { t } = useImportText();
  return (
    <fieldset className="m-0 flex gap-3 border-0 p-0">
      <legend className="mb-1 text-sm font-medium">{t('new.pages')}</legend>
      <NumberField id="import-from" label={t('new.pageFrom')} value={form.pageFrom} onChange={(pageFrom) => onChange({ pageFrom })} />
      <NumberField id="import-to" label={t('new.pageTo')} value={form.pageTo} onChange={(pageTo) => onChange({ pageTo })} />
    </fieldset>
  );
}

export function SheetFields({ form, onChange, spreadsheet }: RangeFieldsProps & { readonly spreadsheet: boolean }) {
  const { t } = useImportText();
  return (
    <fieldset className="m-0 flex gap-3 border-0 p-0">
      <legend className="sr-only">{t('new.sheetOptions')}</legend>
      <NumberField id="import-skip" label={t('new.skipRows')} value={form.skipRows} onChange={(skipRows) => onChange({ skipRows })} />
      {spreadsheet ? <NumberField id="import-sheet" label={t('new.sheet')} value={form.sheetIndex} onChange={(sheetIndex) => onChange({ sheetIndex })} /> : null}
    </fieldset>
  );
}
