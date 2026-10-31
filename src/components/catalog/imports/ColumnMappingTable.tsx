'use client';

/**
 * @fileoverview **Αντιστοίχιση στηλών** (ADR-923 §5.5): κάθε στήλη του αρχείου → πού πάει, με δείγμα δεδομένων. Το αρχείο δεν
 *   αλλάζει ποτέ· μετακινείται η αντιστοίχιση.
 * @module components/catalog/imports/ColumnMappingTable
 */

import React from 'react';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RawTable } from '@/lib/tabular-import/tabular-types';
import type { ImportColumnRule } from '@/subapps/catalog/types/catalog-import';
import { IMPORT_PRICE_FIELDS, type ImportPurpose } from '@/subapps/catalog/vocabulary/catalog-import';
import { IGNORE_ROLE, roleOfTarget, targetOfRole, type AttributeChoice, type ImportRoleKey } from './import-source-file';
import { PRICE_FIELD_KEYS, useImportText } from './import-text';

const SAMPLE_ROWS = 3;

interface ColumnMappingTableProps {
  readonly table: RawTable;
  readonly purpose: ImportPurpose;
  readonly attributes: readonly AttributeChoice[];
  readonly columns: readonly ImportColumnRule[];
  readonly onChange: (columns: readonly ImportColumnRule[]) => void;
}

function useRoleChoices(purpose: ImportPurpose, attributes: readonly AttributeChoice[]) {
  const { t } = useImportText();
  const ignore = { value: IGNORE_ROLE, label: t('mapping.ignore') };
  if (purpose === 'priceLines') {
    return [
      ignore,
      { value: 'skuIdentifier', label: t('mapping.skuIdentifier') },
      ...IMPORT_PRICE_FIELDS.map((field) => ({ value: `price:${field}`, label: t(PRICE_FIELD_KEYS[field]) })),
    ];
  }
  return [ignore, { value: 'modelCode', label: t('mapping.modelCode') }, ...attributes.map((attribute) => ({ value: `attribute:${attribute.id}`, label: attribute.label }))];
}

interface ColumnRowProps {
  readonly column: ImportColumnRule;
  readonly sample: string;
  readonly choices: ReturnType<typeof useRoleChoices>;
  readonly onPatch: (next: Partial<ImportColumnRule>) => void;
}

function ColumnRow({ column, sample, choices, onPatch }: ColumnRowProps) {
  const { t } = useImportText();
  return (
    <tr className="border-b border-border">
      <th scope="row" className="truncate p-2 text-left font-normal">{column.header || t('mapping.columnNumber', { number: column.position + 1 })}</th>
      <td className="truncate p-2 text-muted-foreground">{sample}</td>
      <td className="p-2">
        <Select value={roleOfTarget(column.target)} onValueChange={(role: ImportRoleKey) => onPatch({ target: targetOfRole(role) })}>
          <SelectTrigger aria-label={t('mapping.target')}><SelectValue /></SelectTrigger>
          <SelectContent>
            {choices.map((choice) => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2">
        <Input
          aria-label={t('mapping.unit')}
          value={column.unitCode ?? ''}
          onChange={(event) => onPatch({ unitCode: event.target.value.trim() === '' ? null : event.target.value.trim() })}
        />
      </td>
    </tr>
  );
}

export function ColumnMappingTable({ table, purpose, attributes, columns, onChange }: ColumnMappingTableProps) {
  const { t } = useImportText();
  const choices = useRoleChoices(purpose, attributes);
  const patch = (position: number, next: Partial<ImportColumnRule>) =>
    onChange(columns.map((column) => (column.position === position ? { ...column, ...next } : column)));
  const sampleOf = (position: number) => table.rows.slice(0, SAMPLE_ROWS).map((row) => row[position] ?? '').filter((cell) => cell !== '').join(' · ');
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          <th className="p-2 font-medium">{t('mapping.column')}</th>
          <th className="p-2 font-medium">{t('mapping.sample')}</th>
          <th className="p-2 font-medium">{t('mapping.target')}</th>
          <th className="w-28 p-2 font-medium">{t('mapping.unit')}</th>
        </tr>
      </thead>
      <tbody>
        {columns.map((column) => <ColumnRow key={column.position} column={column} sample={sampleOf(column.position)} choices={choices} onPatch={(next) => patch(column.position, next)} />)}
      </tbody>
    </table>
  );
}
