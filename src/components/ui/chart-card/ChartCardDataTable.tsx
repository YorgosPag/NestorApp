'use client';

/**
 * @module chart-card/ChartCardDataTable
 * @enterprise ADR-710 — The text equivalent of the plot (WCAG 1.1.1).
 *
 * Derived entirely from the card's series description, so it cannot drift from what
 * is drawn: the same `key` feeds the mark and the column, and the same
 * `formatValue` feeds the axis tick and the cell.
 *
 * It is a native `<details>` disclosure rather than a visually-hidden block. Hiding it
 * would satisfy a screen reader and no one else; the measured palette (ADR-710 §4) has
 * two light-mode steps under 3:1 against the card surface, and that relief is owed to
 * sighted low-contrast readers too. Native `<details>` also means the toggle is
 * keyboard-operable with no JavaScript and no focus management of ours.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InfoTableHead } from '@/components/ui/InfoLabel';
import '@/lib/design-system';
import { readChartField, readChartNumber, useChartCard } from './chart-card-context';

/** What a cell shows when the series has no value at that category. */
const MISSING_VALUE = '—';

export interface ChartCardDataTableProps {
  /** Sentence describing what the plot shows. Falls back to the generic caption. */
  readonly caption?: string;
}

export function ChartCardDataTable({ caption }: ChartCardDataTableProps) {
  const { t } = useTranslation('common');
  const {
    series,
    data,
    categoryKey,
    categoryLabel,
    categoryDescription,
    formatValue,
    formatCategory,
  } = useChartCard();

  if (data.length === 0) return null;

  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        {t('chart.showDataTable')}
      </summary>
      <Table className="mt-2">
        <TableCaption>{caption ?? t('chart.dataTableCaption')}</TableCaption>
        <TableHeader>
          <TableRow>
            {/* The explanation travels with the series description, so the word
                "forward rate" means the same thing here as anywhere else the card
                names it. Without a description the header renders plain — the
                affordance appears only when there is something to say. */}
            <InfoTableHead label={categoryLabel} tooltip={categoryDescription} />
            {series.map((entry) => (
              <InfoTableHead
                key={entry.key}
                label={entry.label}
                tooltip={entry.description}
                className="text-right"
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((datum, index) => (
            <TableRow key={`${String(readChartField(datum, categoryKey))}-${index}`}>
              <TableHead scope="row" className="font-normal">
                {formatCategory(readChartField(datum, categoryKey))}
              </TableHead>
              {series.map((entry) => (
                <TableCell key={entry.key} className="text-right tabular-nums">
                  {/* A point the series does not have is not the same as a zero: the
                      plot draws nothing there, so the table says nothing there. */}
                  {readChartField(datum, entry.key) == null
                    ? MISSING_VALUE
                    : formatValue(readChartNumber(datum, entry.key))}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </details>
  );
}
