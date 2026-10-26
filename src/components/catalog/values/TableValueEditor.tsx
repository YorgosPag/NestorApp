'use client';
/**
 * **Ιδιότητα-πίνακας** (π.χ. «αποστάσεις στήριξης ανά διάμετρο») στο **γενικό** πλέγμα (ADR-923 §5.10.4 Β3).
 *
 * Επικόλληση από Excel με νέες γραμμές ως `maxTableValueRows`, πληκτρολόγιο του Excel, αναίρεση (η κοινή
 * `grid-history`). Αφαίρεση γραμμής με το ποντίκι από τη στήλη ενεργειών.
 *
 * @module components/catalog/values/TableValueEditor
 */

import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DataGrid } from '@/components/ui/data-grid/DataGrid';
import type { DataGridChange, DataGridColumn } from '@/components/ui/data-grid/data-grid-types';
import { emptyHistory, recordHistory, redoHistory, undoHistory, type History } from '@/lib/spreadsheet/grid-history';
import type { TableValueRow } from '@/subapps/catalog/types/product';
import { CATALOG_LIMITS } from '@/subapps/catalog/vocabulary/catalog-limits';

import { useIssueMessage } from '../shared/CatalogIssues';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { useCatalogGridWords } from '../shared/use-catalog-grid-words';
import { tableValueColumns, type TableColumnWords } from './table-value-columns';
import type { ValueEditorProps } from './value-editor-types';

type Rows = readonly TableValueRow[];

function useTableWords(props: ValueEditorProps<'table'>): TableColumnWords {
  const message = useIssueMessage();
  const { env } = props;
  return useMemo(() => ({
    language: env.codec.language,
    yes: env.codec.yes,
    no: env.codec.no,
    text: env.text,
    notNumber: message({ code: 'valueNotNumber', path: '' }),
    notBoolean: message({ code: 'valueTypeMismatch', path: '', params: { expected: 'boolean' } }),
    unknownOption: (option) => message({ code: 'optionUnknown', path: '', params: { option } }),
    unitOf: (column) => env.codec.registry.get(column.measurementFamilyCode)?.units.find((unit) => unit.code === column.unitCode)?.symbol ?? column.unitCode,
  }), [env, message]);
}

export function TableValueEditor(props: ValueEditorProps<'table'>) {
  const { t } = useCatalogText();
  const gridWords = useCatalogGridWords();
  const words = useTableWords(props);
  const rows: Rows = props.value?.rows ?? [];
  const [history, setHistory] = useState<History<Rows>>(emptyHistory());
  const write = (next: Rows) => props.onChange(next.length === 0 ? null : { type: 'table', rows: next });
  const commit = (next: Rows) => { setHistory(recordHistory(history, { before: rows, after: next })); write(next); };
  const step = (result: { history: History<Rows>; apply: Rows | null }) => { setHistory(result.history); if (result.apply) write(result.apply); };

  // Χωρίς memo: οι στήλες εξαρτώνται από το `commit` (νέο σε κάθε render) και είναι φθηνές.
  const columns: DataGridColumn<TableValueRow>[] = [
    ...tableValueColumns(props.attribute.config.columns, words),
    { id: '__actions', header: '', label: t('values.table.actions'), width: 'xs', text: () => '',
      render: (row) => props.disabled ? null : (
        <Button type="button" variant="ghost" size="icon" tabIndex={-1} aria-label={t('values.table.removeRow')}
          onClick={() => commit(rows.filter((candidate) => candidate !== row))}><X className="h-3 w-3" aria-hidden /></Button>
      ) },
  ];

  return (
    <section id={props.id} aria-describedby={props.describedBy} className="grid gap-2">
      <DataGrid<TableValueRow> label={props.label} rows={rows} rowKey={(_row, index) => String(index)} columns={columns}
        words={gridWords} createRow={() => ({})} maxRows={CATALOG_LIMITS.maxTableValueRows}
        onChange={props.disabled ? undefined : (change: DataGridChange<TableValueRow>) => commit(change.rows)}
        onUndo={() => step(undoHistory(history))} onRedo={() => step(redoHistory(history))} />
      {props.disabled ? null : (
        <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={rows.length >= CATALOG_LIMITS.maxTableValueRows}
          onClick={() => commit([...rows, {}])}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('values.table.addRow')}</Button>
      )}
    </section>
  );
}
