'use client';

/**
 * @fileoverview **Οι μονάδες μιας οικογένειας μέτρησης, μόνο για ανάγνωση** — πρότυπο, συντελεστής, μετατόπιση, UNECE
 *   (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/measurements/MeasurementUnitsTable
 *
 * 🔑 Ο τύπος μετατροπής **γράφεται** (`πρότυπο = τιμή × συντελεστής + μετατόπιση`): ο μηχανικός βλέπει γιατί
 *    1 °F δεν είναι 1,8 K — η διαφάνεια που λείπει από τις λίστες πράξεων του Akeneo.
 */

import React from 'react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNumber } from '@/lib/intl-formatting';
import type { MeasurementFamilyDefinition } from '@/subapps/catalog/types/measurement-family';
import { useCatalogText } from '../shared/catalog-ui-hooks';

const FACTOR_FORMAT: Intl.NumberFormatOptions = { maximumSignificantDigits: 12 };

export function MeasurementUnitsTable({ family }: { readonly family: MeasurementFamilyDefinition }) {
  const { t } = useCatalogText();
  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 text-sm font-semibold text-foreground">{t('measurement.units')}</h3>
      <p className="m-0 text-xs text-muted-foreground">{t('measurement.formula')}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{t('measurement.unitCode')}</TableHead>
            <TableHead scope="col">{t('measurement.symbol')}</TableHead>
            <TableHead scope="col" className="text-right">{t('measurement.factor')}</TableHead>
            <TableHead scope="col" className="text-right">{t('measurement.offset')}</TableHead>
            <TableHead scope="col">{t('measurement.unece')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {family.units.map((unit) => (
            <TableRow key={unit.code}>
              <TableCell className="font-mono text-xs">
                {unit.code}
                {unit.code === family.standardUnitCode ? (
                  <span className="ml-2 font-sans text-xs text-muted-foreground">{t('measurement.standard')}</span>
                ) : null}
              </TableCell>
              <TableCell>{unit.symbol}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(unit.factor, FACTOR_FORMAT)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(unit.offset ?? 0, FACTOR_FORMAT)}</TableCell>
              <TableCell className="font-mono text-xs">{unit.unece ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
