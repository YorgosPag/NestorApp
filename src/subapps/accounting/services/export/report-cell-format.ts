/**
 * @fileoverview Report Cell Format — ΕΝΑΣ μορφοποιητής κελιού για τον πίνακα της οθόνης και το PDF
 * @description Η μορφή (ποσό · πλήθος · ποσοστό) έρχεται από τη στήλη/γραμμή (`cellFormatOf`), όχι από τη θέση της
 *   στήλης. Γλώσσα αριθμών = η γλώσσα της διεπαφής (`@/lib/intl-utils`) — η ίδια με τον `t` που μετέφρασε τις
 *   κεφαλίδες, γιατί όλα τρέχουν στον browser του ίδιου χρήστη.
 *
 * @see report-table-adapter.ts · ADR-ACC-010 §2.1.1 changelog 2026-10-30
 */

import { formatNumber, formatPercentage } from '@/lib/intl-utils';

import { formatAccountingCurrency } from '../../utils/format';
import type { CellValue, ReportValueFormat } from './report-table-adapter';

/** `screen`: ποσό με σύμβολο νομίσματος · `document`: γυμνός αριθμός με δύο δεκαδικά (στήλες PDF). */
export type ReportNumberStyle = 'screen' | 'document';

export function formatReportNumber(value: number, format: ReportValueFormat, style: ReportNumberStyle): string {
  switch (format) {
    case 'currency':
      return style === 'screen'
        ? formatAccountingCurrency(value)
        : formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'count':
      return formatNumber(value, { maximumFractionDigits: 0 });
    case 'percent':
      return formatPercentage(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
}

/** Κελί → κείμενο. `null` τιμή ⇒ «—»· κείμενο ή στήλη χωρίς αριθμητική μορφή ⇒ όπως είναι. */
export function formatReportCell(value: CellValue, format: ReportValueFormat | null, style: ReportNumberStyle): string {
  if (value === null) return '—';
  if (typeof value === 'string' || format === null) return String(value);
  return formatReportNumber(value, format, style);
}

/** Μεταβολή με πρόσημο: «+1.234,00 €» · «-12» · «0». */
export function formatReportChange(value: number, format: ReportValueFormat, style: ReportNumberStyle): string {
  const text = formatReportNumber(value, format, style);
  return value > 0 ? `+${text}` : text;
}
