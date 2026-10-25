'use client';

/**
 * @fileoverview **Οι μονάδες μιας οικογένειας μέτρησης του χώρου, ως πίνακας επεξεργασίας** (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/measurements/MeasurementUnitsEditor
 *
 * 🔑 **Όσο η οικογένεια χρησιμοποιείται, οι υπάρχουσες μονάδες κλειδώνουν** (κωδικός · συντελεστής · μετατόπιση ·
 *    πρότυπο) — append-only, όπως UCUM/QUDT. Νέες μονάδες προστίθενται ελεύθερα. Το κλείδωμα **φαίνεται** (μόνο
 *    ανάγνωση + εξήγηση), δεν ανακαλύπτεται ως άρνηση του διακομιστή.
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericField } from '@/components/ui/numeric-field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { MeasurementUnitDefinition, WorkspaceMeasurementFamilyDefinition } from '@/subapps/catalog/types/measurement-family';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { FieldIssues } from '../shared/CatalogIssues';
import { withNewUnit, withoutUnit, withUnit } from './measurement-draft';

interface MeasurementUnitsEditorProps {
  readonly draft: WorkspaceMeasurementFamilyDefinition;
  readonly onChange: (draft: WorkspaceMeasurementFamilyDefinition) => void;
  readonly issues: readonly CatalogIssue[];
  /** Κωδικοί μονάδων που είναι κλειδωμένοι (η οικογένεια χρησιμοποιείται). */
  readonly lockedCodes: ReadonlySet<string>;
  readonly disabled: boolean;
}

interface UnitRowProps {
  readonly unit: MeasurementUnitDefinition;
  readonly index: number;
  readonly locked: boolean;
  readonly disabled: boolean;
  readonly onChange: (unit: MeasurementUnitDefinition) => void;
  readonly onRemove: () => void;
}

function UnitRow({ unit, index, locked, disabled, onChange, onRemove }: UnitRowProps) {
  const { t } = useCatalogText();
  const fixed = locked || disabled;
  const label = (key: string) => t(key, { index: index + 1 });
  return (
    <TableRow>
      <TableCell>
        <RadioGroupItem value={radioValueOf(index)} id={`standard-${index}`} disabled={locked || disabled || unit.code.length === 0} aria-label={label('measurement.editor.standardOf')} />
      </TableCell>
      <TableCell>
        <Input value={unit.code} readOnly={fixed} className="w-28 font-mono" aria-label={label('measurement.editor.codeOf')} onChange={(event) => onChange({ ...unit, code: event.target.value })} />
      </TableCell>
      <TableCell>
        <Input value={unit.symbol} disabled={disabled} className="w-24" aria-label={label('measurement.editor.symbolOf')} onChange={(event) => onChange({ ...unit, symbol: event.target.value })} />
      </TableCell>
      <TableCell>
        <NumericField value={unit.factor} disabled={fixed} className="w-32" aria-label={label('measurement.editor.factorOf')} onValueChange={(factor) => onChange({ ...unit, factor })} />
      </TableCell>
      <TableCell>
        <NumericField value={unit.offset ?? 0} disabled={fixed} className="w-24" aria-label={label('measurement.editor.offsetOf')} onValueChange={(offset) => onChange({ ...unit, offset: offset === 0 ? undefined : offset })} />
      </TableCell>
      <TableCell>
        <Input value={unit.unece ?? ''} disabled={disabled} className="w-20 font-mono uppercase" aria-label={label('measurement.editor.uneceOf')} onChange={(event) => onChange({ ...unit, unece: event.target.value.length > 0 ? event.target.value.toUpperCase() : undefined })} />
      </TableCell>
      <TableCell>
        <Button type="button" variant="ghost" size="icon" disabled={fixed} aria-label={label('measurement.editor.removeUnit')} onClick={onRemove}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </TableCell>
    </TableRow>
  );
}

/**
 * Η τιμή του radio είναι η **θέση** της γραμμής, όχι ο κωδικός: νέες γραμμές έχουν κενό κωδικό, και πολλά radio με
 * τιμή `''` θα φαίνονταν όλα «πρότυπο» όσο το πρότυπο είναι κενό.
 */
const radioValueOf = (index: number) => `unit-${index}`;

function standardRadioValue(draft: WorkspaceMeasurementFamilyDefinition): string {
  const index = draft.standardUnitCode.length === 0 ? -1 : draft.units.findIndex((unit) => unit.code === draft.standardUnitCode);
  return index === -1 ? '' : radioValueOf(index);
}

export function MeasurementUnitsEditor({ draft, onChange, issues, lockedCodes, disabled }: MeasurementUnitsEditorProps) {
  const { t } = useCatalogText();
  const standardLocked = lockedCodes.size > 0;
  const chooseStandard = (value: string) => {
    const unit = draft.units.find((_, index) => radioValueOf(index) === value);
    if (unit) onChange({ ...draft, standardUnitCode: unit.code });
  };
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-foreground">{t('measurement.units')}</legend>
      <p className="m-0 text-xs text-muted-foreground">{t(standardLocked ? 'measurement.editor.lockedHint' : 'measurement.formula')}</p>
      <RadioGroup value={standardRadioValue(draft)} disabled={standardLocked || disabled} onValueChange={chooseStandard} aria-label={t('measurement.standard')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t('measurement.standard')}</TableHead>
              <TableHead scope="col">{t('measurement.unitCode')}</TableHead>
              <TableHead scope="col">{t('measurement.symbol')}</TableHead>
              <TableHead scope="col">{t('measurement.factor')}</TableHead>
              <TableHead scope="col">{t('measurement.offset')}</TableHead>
              <TableHead scope="col">{t('measurement.unece')}</TableHead>
              <TableHead scope="col"><span className="sr-only">{t('common.actions')}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {draft.units.map((unit, index) => (
              <UnitRow
                key={index}
                unit={unit}
                index={index}
                locked={lockedCodes.has(unit.code)}
                disabled={disabled}
                onChange={(next) => onChange(withUnit(draft, index, next))}
                onRemove={() => onChange(withoutUnit(draft, index))}
              />
            ))}
          </TableBody>
        </Table>
      </RadioGroup>
      <FieldIssues issues={issues} path="units" />
      <FieldIssues issues={issues} path="standardUnitCode" exact />
      <Button type="button" variant="outline" size="sm" className="self-start" disabled={disabled || draft.singleUnit && draft.units.length >= 1} onClick={() => onChange(withNewUnit(draft))}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />
        {t('measurement.editor.addUnit')}
      </Button>
    </fieldset>
  );
}
