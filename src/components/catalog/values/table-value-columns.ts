/**
 * **Οι στήλες μιας ιδιότητας-πίνακα στο γενικό πλέγμα** — καθαρό (ADR-923 §5.10.4 Β3).
 *
 * Κελί πίνακα = κείμενο · κωδικός επιλογής · **κανονικό ποσό** (στη μονάδα της στήλης) · ναι/όχι. Η γραμματική είναι
 * η **ίδια** με τον κωδικοποιητή τιμών (`parseEnteredAmount` · `displayAmount` · ταίριασμα επιλογής κατά κωδικό ή
 * ετικέτα), ώστε επικόλληση πίνακα από Excel να διαβάζεται όπως κάθε άλλη τιμή.
 *
 * @module components/catalog/values/table-value-columns
 */

import type { DataGridColumn, DataGridParse } from '@/components/ui/data-grid/data-grid-types';
import type { HumanLanguage } from '@/i18n/languages';
import type { LocalizedText } from '@/i18n/localized-text';
import { normalizeSearchText } from '@/lib/search/search';
import type { TableColumn } from '@/subapps/catalog/types/attribute';
import type { TableValueRow } from '@/subapps/catalog/types/product';
import { parseEnteredAmount } from '@/subapps/catalog/values/decimal-amount';
import { displayAmount } from '@/subapps/catalog/values/value-text-codec';

export interface TableColumnWords {
  readonly language: HumanLanguage;
  readonly yes: string;
  readonly no: string;
  readonly text: (value: LocalizedText | undefined, fallback?: string) => string;
  readonly notNumber: string;
  readonly notBoolean: string;
  readonly unknownOption: (text: string) => string;
  readonly unitOf: (column: Extract<TableColumn, { readonly type: 'measurement' }>) => string;
}

const norm = (text: string) => normalizeSearchText(text.toLowerCase());

function withCell(row: TableValueRow, code: string, value: string | boolean | null): TableValueRow {
  if (value === null) return Object.fromEntries(Object.entries(row).filter(([key]) => key !== code));
  return { ...row, [code]: value };
}

function parseCell(column: TableColumn, text: string, w: TableColumnWords): { readonly ok: true; readonly value: string | boolean | null } | { readonly ok: false; readonly issue: string } {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  switch (column.type) {
    case 'text': return { ok: true, value: trimmed };
    case 'boolean': {
      const wanted = norm(trimmed);
      if ([norm(w.yes), 'yes', 'ναι', 'true', '1', '✓'].includes(wanted)) return { ok: true, value: true };
      if ([norm(w.no), 'no', 'οχι', 'false', '0'].includes(wanted)) return { ok: true, value: false };
      return { ok: false, issue: w.notBoolean };
    }
    case 'number':
    case 'measurement': {
      // Η στήλη μέτρησης έχει **σταθερή** μονάδα: «380 m³/h» ≡ «380» (η μονάδα γράφεται και στην κεφαλίδα).
      const unit = column.type === 'measurement' ? w.unitOf(column) : '';
      const amountText = unit !== '' && trimmed.endsWith(unit) ? trimmed.slice(0, -unit.length).trim() : trimmed;
      const parsed = parseEnteredAmount(amountText);
      return parsed ? { ok: true, value: parsed.amount } : { ok: false, issue: w.notNumber };
    }
    case 'select': {
      const option = column.options.find((candidate) => norm(candidate.code) === norm(trimmed) || Object.values(candidate.labels).some((label) => label && norm(label) === norm(trimmed)));
      return option ? { ok: true, value: option.code } : { ok: false, issue: w.unknownOption(trimmed) };
    }
  }
}

function formatCell(column: TableColumn, value: string | boolean | undefined, w: TableColumnWords): string {
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value ? w.yes : w.no;
  if (column.type === 'number' || column.type === 'measurement') return displayAmount(value, w.language);
  if (column.type === 'select') return w.text(column.options.find((option) => option.code === value)?.labels, value);
  return value;
}

/** Οι στήλες του πλέγματος για τις στήλες της ιδιότητας-πίνακα. */
export function tableValueColumns(columns: readonly TableColumn[], w: TableColumnWords): DataGridColumn<TableValueRow>[] {
  return columns.map((column) => ({
    id: column.code,
    header: column.type === 'measurement' ? `${w.text(column.labels, column.code)} (${w.unitOf(column)})` : w.text(column.labels, column.code),
    label: w.text(column.labels, column.code),
    width: column.type === 'text' ? 'lg' : 'md',
    align: column.type === 'number' || column.type === 'measurement' ? 'end' : 'start',
    text: (row) => formatCell(column, row[column.code], w),
    parse: (text, row): DataGridParse<TableValueRow> => {
      const parsed = parseCell(column, text, w);
      return parsed.ok ? { ok: true, row: withCell(row, column.code, parsed.value) } : parsed;
    },
    choices: column.type === 'select' ? () => column.options.map((option) => ({ text: option.code, label: w.text(option.labels, option.code) })) : undefined,
    toggle: column.type === 'boolean' ? (row) => withCell(row, column.code, row[column.code] !== true) : undefined,
  }));
}
