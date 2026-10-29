'use client';

/**
 * @fileoverview **Ο πίνακας συνθηκών** — ομάδα έκπτωσης × κοινό, ο ισχύων κανόνας σε κάθε κελί (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related condition-matrix.ts (το καθαρό μοντέλο) · ConditionsPanel.tsx (ο γονέας: πίνακας + επιθεωρητής)
 * @module components/catalog/pricing/ConditionMatrix
 *
 * SAP condition table (VK13) με την πυκνότητα ενός Figma inspector: **σημασιολογικός** πίνακας (`th scope`) ώστε ο αναγνώστης
 * οθόνης να λέει «TOSH-CARR, Συνεργάτες: −55%»· κάθε κελί είναι κουμπί, και τα **βέλη** μετακινούν την εστίαση στο πλέγμα.
 *
 * 🔑 **Το κελί λέει όλη την αλήθεια του, χωρίς χρώμα** (CHECK 3.41): μεγάλο το πραγματικό ποσοστό («−55%»), μικρά τα βήματα
 *    («50 + 10»)· εικονίδιο + αριθμός για τις **μελλοντικές** περιόδους· **ασάφεια** = εικονίδιο + λέξη + κόκκινο πλαίσιο.
 * 🔑 Το **πρόχειρο** του επεξεργαστή φαίνεται στον πίνακα (διακεκομμένο πλαίσιο) — ο άνθρωπος βλέπει πού θα «προσγειωθεί».
 */

import React, { useCallback } from 'react';
import { AlertTriangle, Clock, Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { cellKeyOf, ruleHeadline, type ConditionMatrix as Matrix, type MatrixCell, type MatrixColumn, type MatrixRow } from './condition-matrix';
import { chainTextOf } from './discount-chain-input';
import { AUDIENCE_KIND_ICONS, AUDIENCE_KIND_KEYS } from './pricing-labels';
import { formatDiscountPercent } from './use-discount-words';

interface ConditionMatrixProps {
  readonly matrix: Matrix;
  readonly selectedCell: string | null;
  readonly onCell: (row: MatrixRow, column: MatrixColumn) => void;
}

const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
};

/** Τα βέλη μετακινούν την εστίαση από κελί σε κελί (data-grid χωρίς ρόλο grid: τα κελιά μένουν απλά κουμπιά). */
function useArrowNavigation() {
  return useCallback((event: React.KeyboardEvent<HTMLTableElement>) => {
    const move = ARROWS[event.key];
    const from = (event.target as HTMLElement).closest<HTMLElement>('[data-cell-row]');
    if (!move || !from) return;
    const row = Number(from.dataset.cellRow) + move[0];
    const column = Number(from.dataset.cellColumn) + move[1];
    const next = event.currentTarget.querySelector<HTMLElement>(`[data-cell-row="${row}"][data-cell-column="${column}"]`);
    if (next) { event.preventDefault(); next.focus(); }
  }, []);
}

function CellFigure({ cell }: { readonly cell: MatrixCell }) {
  const { t } = useCatalogText();
  if (cell.current.length > 1) {
    return <span className="text-sm font-semibold">{t('pricing.discounts.matrix.partners', { count: cell.current.length })}</span>;
  }
  const current = cell.current[0];
  if (!current) return <span className="text-sm text-muted-foreground">{t('pricing.discounts.matrix.notNow')}</span>;
  const headline = ruleHeadline(current.definition.rule);
  if (headline.kind === 'unreadable') return <span className="text-sm text-muted-foreground">{t('pricing.discounts.rule.unreadable')}</span>;
  if (headline.kind === 'tiers') {
    return (
      <span className="flex flex-col">
        <span className="text-base font-semibold tabular-nums">{t('pricing.discounts.matrix.range', { lowest: formatDiscountPercent(headline.lowest), highest: formatDiscountPercent(headline.highest) })}</span>
        <span className="text-xs text-muted-foreground">{t('pricing.discounts.matrix.tiers', { count: headline.count })}</span>
      </span>
    );
  }
  return (
    <span className="flex flex-col">
      <span className="text-base font-semibold tabular-nums">{t('pricing.discounts.matrix.effective', { effective: formatDiscountPercent(headline.effective) })}</span>
      {headline.steps.length > 1 ? <span className="text-xs tabular-nums text-muted-foreground">{chainTextOf(headline.steps, formatDiscountPercent)}</span> : null}
    </span>
  );
}

function CellMarks({ cell }: { readonly cell: MatrixCell }) {
  const { t } = useCatalogText();
  const upcoming = cell.entries.filter((entry) => entry.verdict === 'notYetValid').length;
  return (
    <span className="flex flex-wrap items-center gap-1 text-xs">
      {cell.ambiguous ? (
        <span className="flex items-center gap-0.5 font-medium text-destructive"><AlertTriangle className="h-3 w-3" aria-hidden />{t('pricing.discounts.matrix.ambiguous')}</span>
      ) : null}
      {upcoming > 0 ? (
        <span className="flex items-center gap-0.5 text-muted-foreground"><Clock className="h-3 w-3" aria-hidden />{t('pricing.discounts.matrix.upcoming', { count: upcoming })}</span>
      ) : null}
    </span>
  );
}

interface CellButtonProps {
  readonly cell: MatrixCell | undefined;
  readonly selected: boolean;
  readonly position: { readonly row: number; readonly column: number };
  readonly label: string;
  readonly onSelect: () => void;
}

function CellButton({ cell, selected, position, label, onSelect }: CellButtonProps) {
  const { t } = useCatalogText();
  const hasDraft = cell?.entries.some((entry) => entry.isDraft) ?? false;
  return (
    <button
      type="button"
      data-cell-row={position.row}
      data-cell-column={position.column}
      aria-pressed={selected}
      aria-label={cell ? undefined : t('pricing.discounts.matrix.emptyCell', { cell: label })}
      onClick={onSelect}
      className={cn(
        'group flex h-full min-h-14 w-full min-w-28 flex-col items-start justify-center gap-0.5 rounded-md border px-2 py-1.5 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-ring bg-accent text-accent-foreground' : 'border-transparent hover:bg-accent/50',
        cell?.ambiguous && 'border-destructive bg-destructive/5',
        hasDraft && 'border-dashed',
      )}
    >
      {cell ? (
        <>
          <CellFigure cell={cell} />
          <CellMarks cell={cell} />
        </>
      ) : (
        <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
      )}
    </button>
  );
}

function ColumnHeader({ column }: { readonly column: MatrixColumn }) {
  const { t, text } = useCatalogText();
  const Icon = AUDIENCE_KIND_ICONS[column.kind];
  const label = column.kind === 'customerGroup' ? text(column.group.labels, column.group.code) : t(AUDIENCE_KIND_KEYS[column.kind]);
  return (
    <th scope="col" className="border-b px-2 py-2 text-left align-bottom text-xs font-semibold text-muted-foreground">
      <span className="flex items-center gap-1"><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />{label}</span>
    </th>
  );
}

function RowHeader({ row }: { readonly row: MatrixRow }) {
  const { t, text } = useCatalogText();
  return (
    <th scope="row" className="sticky left-0 z-[1] border-r bg-card px-2 py-1 text-left align-middle">
      <span className="flex flex-col">
        <span className="text-sm font-medium">{row.group ? text(row.group.labels, row.group.code) : t('pricing.discounts.matrix.allGroups')}</span>
        {row.group ? <span className="font-mono text-xs text-muted-foreground">{row.group.code}</span> : null}
      </span>
    </th>
  );
}

export function ConditionMatrix({ matrix, selectedCell, onCell }: ConditionMatrixProps) {
  const { t, text } = useCatalogText();
  const onKeyDown = useArrowNavigation();
  const columnLabel = (column: MatrixColumn) => (column.kind === 'customerGroup' ? text(column.group.labels, column.group.code) : t(AUDIENCE_KIND_KEYS[column.kind]));
  const rowLabel = (row: MatrixRow) => (row.group ? text(row.group.labels, row.group.code) : t('pricing.discounts.matrix.allGroups'));
  return (
    <section className="min-w-0 overflow-x-auto rounded-md border bg-card" aria-label={t('pricing.discounts.matrix.caption')}>
      <table className="w-full border-separate border-spacing-0 text-sm" onKeyDown={onKeyDown}>
        <caption className="sr-only">{t('pricing.discounts.matrix.caption')}</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-[1] border-b border-r bg-card px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
              {t('pricing.discounts.matrix.groupHeader')}
            </th>
            {matrix.columns.map((column) => <ColumnHeader key={column.key} column={column} />)}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row, rowIndex) => (
            <tr key={row.key}>
              <RowHeader row={row} />
              {matrix.columns.map((column, columnIndex) => {
                const key = cellKeyOf(row.key, column.key);
                return (
                  <td key={column.key} className="border-b p-1 align-top">
                    <CellButton cell={matrix.cells.get(key)} selected={selectedCell === key} position={{ row: rowIndex, column: columnIndex }}
                      label={`${rowLabel(row)} × ${columnLabel(column)}`} onSelect={() => onCell(row, column)} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
