'use client';

/**
 * @fileoverview **Ζωντανή δοκιμή μετατροπής** — «1 kW είναι πόσα kcal/h;» πριν η οικογένεια μπει σε χρήση (ADR-923 §5.2).
 * @module components/catalog/measurements/MeasurementConversionTester
 *
 * 🔑 Η **ίδια** μηχανή (`convertMeasurement`) που θα μετατρέπει τιμές προϊόντων στη Φάση 2 — η δοκιμή δεν είναι
 *    προσομοίωση. Στον επεξεργαστή τρέχει πάνω στο **πρόχειρο**: λάθος συντελεστής φαίνεται πριν αποθηκευτεί.
 * ⚠️ Πρόχειρο με άκυρη μονάδα ⇒ «—» σε εκείνη τη γραμμή, ποτέ εξαίρεση που ρίχνει την οθόνη.
 */

import React, { useId, useState } from 'react';

import { Label } from '@/components/ui/label';
import { NumericField } from '@/components/ui/numeric-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatNumber } from '@/lib/intl-formatting';
import { convertMeasurement } from '@/subapps/catalog/measurement/conversion';
import type { MeasurementFamilyDefinition } from '@/subapps/catalog/types/measurement-family';
import { useCatalogText } from '../shared/catalog-ui-hooks';

const RESULT_FORMAT: Intl.NumberFormatOptions = { maximumSignificantDigits: 10 };

function safeConvert(family: MeasurementFamilyDefinition, value: number, from: string, to: string): number | null {
  try {
    return convertMeasurement(family, value, from, to);
  } catch {
    return null;
  }
}

export function MeasurementConversionTester({ family }: { readonly family: MeasurementFamilyDefinition }) {
  const { t } = useCatalogText();
  const id = useId();
  const [value, setValue] = useState(1);
  const [chosenUnit, setChosenUnit] = useState<string | null>(null);
  const fromUnit = chosenUnit !== null && family.units.some((unit) => unit.code === chosenUnit) ? chosenUnit : family.standardUnitCode;
  const validUnits = family.units.filter((unit) => unit.code.length > 0);
  return (
    <section className="flex flex-col gap-2 rounded-md border p-3" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="m-0 text-sm font-semibold text-foreground">{t('measurement.tester.title')}</h3>
      <p className="m-0 flex flex-wrap items-end gap-2">
        <span className="flex flex-col gap-1">
          <Label htmlFor={`${id}-value`}>{t('measurement.tester.value')}</Label>
          <NumericField id={`${id}-value`} value={value} onValueChange={setValue} />
        </span>
        <span className="flex flex-col gap-1">
          <Label htmlFor={`${id}-unit`}>{t('measurement.tester.unit')}</Label>
          <Select value={fromUnit} onValueChange={setChosenUnit}>
            <SelectTrigger id={`${id}-unit`} className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {validUnits.map((unit) => <SelectItem key={unit.code} value={unit.code}>{unit.symbol || unit.code}</SelectItem>)}
            </SelectContent>
          </Select>
        </span>
      </p>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" aria-live="polite">
        {validUnits.map((unit) => {
          const result = safeConvert(family, value, fromUnit, unit.code);
          return (
            <React.Fragment key={unit.code}>
              <dt className="text-muted-foreground">{unit.symbol || unit.code}</dt>
              <dd className="m-0 tabular-nums">{result === null ? '—' : formatNumber(result, RESULT_FORMAT)}</dd>
            </React.Fragment>
          );
        })}
      </dl>
    </section>
  );
}
