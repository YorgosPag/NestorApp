'use client';

/**
 * @fileoverview **Οι στήλες μιας ιδιότητας-πίνακα** (π.χ. καμπύλη αντλίας: παροχή → μανομετρικό) (ADR-923 §5.2).
 * @module components/catalog/attributes/TableColumnsEditor
 *
 * 🔑 **Η πρώτη στήλη είναι το κλειδί** (μοναδικό ανά γραμμή) — λέγεται στην οθόνη, και η αναδιάταξη (σύρσιμο) αλλάζει
 *    ποια είναι. Τύπος στήλης = υποσύνολο των τύπων ιδιότητας (`TABLE_COLUMN_TYPES`): μια στήλη μέτρησης σημαίνει **το
 *    ίδιο** με μια ιδιότητα μέτρησης, και ζητά οικογένεια + μονάδα από το **ίδιο** μητρώο.
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericField } from '@/components/ui/numeric-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SortableList } from '@/components/ui/sortable/SortableList';
import { reorderByMove } from '@/components/ui/sortable/sortable-model';
import type { MeasurementRegistry } from '@/subapps/catalog/measurement/measurement-registry';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { TableColumn } from '@/subapps/catalog/types/attribute';
import { TABLE_COLUMN_TYPES, type TableColumnType } from '@/subapps/catalog/vocabulary/attribute-types';
import { CATALOG_LIMITS } from '@/subapps/catalog/vocabulary/catalog-limits';
import { useMeasurementFamilyName } from '../measurements/MeasurementFamilyList';
import { ATTRIBUTE_TYPE_KEYS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { FieldIssues } from '../shared/CatalogIssues';
import { InlineLocalizedInputs } from '../shared/LocalizedTextField';
import { OptionsEditor } from './OptionsEditor';

interface TableColumnsEditorProps {
  readonly columns: readonly TableColumn[];
  readonly onChange: (columns: readonly TableColumn[]) => void;
  readonly registry: MeasurementRegistry;
  readonly issues: readonly CatalogIssue[];
  readonly disabled: boolean;
}

/** Νέα στήλη του τύπου, κρατώντας κωδικό και ετικέτα — η ρύθμιση του τύπου ξεκινά από την αρχή. */
export function columnOfType(column: TableColumn, type: TableColumnType, registry: MeasurementRegistry): TableColumn {
  const base = { code: column.code, labels: column.labels };
  switch (type) {
    case 'text': return { ...base, type };
    case 'boolean': return { ...base, type };
    case 'number': return { ...base, type, decimals: 0 };
    case 'select': return { ...base, type, options: [] };
    case 'measurement': {
      const family = registry.families[0];
      return { ...base, type, measurementFamilyCode: family?.code ?? '', unitCode: family?.standardUnitCode ?? '', decimals: 2 };
    }
  }
}

interface ColumnRowProps {
  readonly column: TableColumn;
  readonly index: number;
  readonly handle: React.ReactNode;
  readonly registry: MeasurementRegistry;
  readonly issues: readonly CatalogIssue[];
  readonly disabled: boolean;
  readonly onChange: (column: TableColumn) => void;
  readonly onRemove: () => void;
}

function MeasurementColumnFields({ column, registry, disabled, onChange }: Pick<ColumnRowProps, 'registry' | 'disabled' | 'onChange'> & {
  readonly column: Extract<TableColumn, { readonly type: 'measurement' }>;
}) {
  const { t } = useCatalogText();
  const nameOf = useMeasurementFamilyName();
  const family = registry.get(column.measurementFamilyCode);
  return (
    <>
      <Select value={family ? column.measurementFamilyCode : ''} disabled={disabled} onValueChange={(code) => {
        const next = registry.get(code);
        if (next) onChange({ ...column, measurementFamilyCode: code, unitCode: next.standardUnitCode });
      }}>
        <SelectTrigger className="w-48" aria-label={t('attributes.config.measurementFamily')}><SelectValue placeholder={t('attributes.config.chooseFamily')} /></SelectTrigger>
        <SelectContent>{registry.families.map((item) => <SelectItem key={item.code} value={item.code}>{nameOf(item)}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={family?.units.some((unit) => unit.code === column.unitCode) ? column.unitCode : ''} disabled={disabled || !family} onValueChange={(unitCode) => onChange({ ...column, unitCode })}>
        <SelectTrigger className="w-28" aria-label={t('attributes.config.defaultUnit')}><SelectValue placeholder={t('attributes.config.chooseUnit')} /></SelectTrigger>
        <SelectContent>{(family?.units ?? []).map((unit) => <SelectItem key={unit.code} value={unit.code}>{unit.symbol}</SelectItem>)}</SelectContent>
      </Select>
      <NumericField className="w-20" aria-label={t('attributes.config.decimals')} value={column.decimals} min={0} max={CATALOG_LIMITS.maxDecimals} step={1} disabled={disabled} onValueChange={(decimals) => onChange({ ...column, decimals })} />
    </>
  );
}

function ColumnRow({ column, index, handle, registry, issues, disabled, onChange, onRemove }: ColumnRowProps) {
  const { t } = useCatalogText();
  const path = `config.columns[${index}]`;
  const chooseType = (type: string) => {
    const match = TABLE_COLUMN_TYPES.find((item) => item === type);
    if (match) onChange(columnOfType(column, match, registry));
  };
  return (
    <div className="flex flex-col gap-2 rounded-md border p-2">
      <span className="flex flex-wrap items-center gap-2">
        {handle}
        {index === 0 ? <Badge variant="info">{t('attributes.columns.key')}</Badge> : null}
        <Input className="w-32 font-mono" aria-label={t('attributes.columns.codeOf', { index: index + 1 })} value={column.code} disabled={disabled} onChange={(event) => onChange({ ...column, code: event.target.value })} />
        <InlineLocalizedInputs value={column.labels} disabled={disabled} label={t('attributes.columns.labelOf', { index: index + 1 })} onChange={(labels) => onChange({ ...column, labels })} />
        <Select value={column.type} disabled={disabled} onValueChange={chooseType}>
          <SelectTrigger className="w-44" aria-label={t('attributes.columns.typeOf', { index: index + 1 })}><SelectValue /></SelectTrigger>
          <SelectContent>{TABLE_COLUMN_TYPES.map((type) => <SelectItem key={type} value={type}>{t(ATTRIBUTE_TYPE_KEYS[type])}</SelectItem>)}</SelectContent>
        </Select>
        {column.type === 'number' ? (
          <NumericField className="w-20" aria-label={t('attributes.config.decimals')} value={column.decimals} min={0} max={CATALOG_LIMITS.maxDecimals} step={1} disabled={disabled} onValueChange={(decimals) => onChange({ ...column, decimals })} />
        ) : null}
        {column.type === 'measurement' ? <MeasurementColumnFields column={column} registry={registry} disabled={disabled} onChange={onChange} /> : null}
        <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t('attributes.columns.removeOf', { index: index + 1 })} onClick={onRemove}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </span>
      {column.type === 'select' ? (
        <OptionsEditor options={column.options} path={`${path}.options`} issues={issues} disabled={disabled} onChange={(options) => onChange({ ...column, options })} />
      ) : null}
      <FieldIssues issues={issues.filter((issue) => !issue.path.startsWith(`${path}.options`))} path={path} />
    </div>
  );
}

export function TableColumnsEditor({ columns, onChange, registry, issues, disabled }: TableColumnsEditorProps) {
  const { t, text } = useCatalogText();
  const rows = columns.map((column, index) => ({ id: `column-${index}`, column, index }));
  const replace = (index: number, column: TableColumn) => onChange(columns.map((current, at) => (at === index ? column : current)));
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-foreground">{t('attributes.columns.title')}</legend>
      <p className="m-0 text-xs text-muted-foreground">{t('attributes.columns.hint')}</p>
      <SortableList
        items={rows}
        getId={(row) => row.id}
        getLabel={(row) => text(row.column.labels, row.column.code)}
        ariaLabel={t('attributes.columns.title')}
        disabled={disabled}
        onMove={(move) => onChange(reorderByMove(rows, (row) => row.id, move).map((row) => row.column))}
        renderItem={(row, handle) => (
          <ColumnRow column={row.column} index={row.index} handle={handle} registry={registry} issues={issues} disabled={disabled}
            onChange={(column) => replace(row.index, column)}
            onRemove={() => onChange(columns.filter((_, at) => at !== row.index))} />
        )}
      />
      <FieldIssues issues={issues.filter((issue) => issue.path === 'config.columns')} path="config.columns" exact />
      <Button type="button" variant="outline" size="sm" className="self-start" disabled={disabled || columns.length >= CATALOG_LIMITS.maxTableColumns}
        onClick={() => onChange([...columns, { code: '', labels: {}, type: 'text' }])}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />{t('attributes.columns.add')}
      </Button>
    </fieldset>
  );
}
