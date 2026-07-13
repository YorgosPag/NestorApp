/**
 * BIM Schedule Export — CSV Exporter (ADR-363 §6 Phase 8).
 *
 * Vanilla TS CSV generation με UTF-8 BOM για Excel compatibility (Greek
 * characters render σωστά όταν το Excel ανοίγει το .csv). Pattern mirror
 * από `accounting/services/export/csv-exporter.ts` (SSoT για app-level CSV).
 *
 * Layout:
 *   row 1   — title (escaped)
 *   row 2   — Ημ. Εξαγωγής: <ISO date>
 *   row 3   — (blank)
 *   row 4   — headers (column i18nKey-resolved labels)
 *   row 5+  — data rows
 *
 * SSoT:
 *   - Cell escaping: wrap σε διπλά εισαγωγικά αν περιέχει `,` / `"` / newline
 *   - Internal `"` doubled per RFC 4180
 *   - UTF-8 BOM (﻿) στην αρχή του blob για Excel auto-detect
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

import { nowISO } from '@/lib/date-local';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import type {
  ExportableTable,
  ScheduleExportOptions,
} from '../types';
import { formatCellForDisplay } from './value-formatters';

// ─── Cell escaping (RFC 4180) ────────────────────────────────────────────────

function escapeCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── Header label resolver ───────────────────────────────────────────────────

/**
 * Header label resolver — caller wires this από i18n `t()`. Schedule
 * builder produces column `i18nKey`; exporter translates at consumption
 * time so the locale switches don't bake into the schedule object.
 */
export type HeaderTranslator = (i18nKey: string) => string;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Serialise a Schedule σε CSV string με UTF-8 BOM prefix.
 * Pure function — no side effects. Used by tests + the download wrapper.
 */
export function scheduleToCsv(
  schedule: ExportableTable,
  options: ScheduleExportOptions,
  translateHeader: HeaderTranslator,
): string {
  const lines: string[] = [];

  // Title + metadata
  lines.push(escapeCell(options.title));
  lines.push(escapeCell(`Ημ. Εξαγωγής: ${nowISO().slice(0, 10)}`));
  lines.push('');

  // Headers
  const headerRow = schedule.columns.map((c) => escapeCell(translateHeader(c.i18nKey))).join(',');
  lines.push(headerRow);

  // Data rows
  for (const row of schedule.rows) {
    const cells = schedule.columns.map((col) => {
      const raw = row.cells[col.key] ?? null;
      return escapeCell(formatCellForDisplay(raw, col.valueType));
    });
    lines.push(cells.join(','));
  }

  return `﻿${lines.join('\r\n')}`;
}

/**
 * Trigger a browser download of the schedule as a UTF-8 BOM CSV file.
 * Filename gets `.csv` extension appended (caller passes sans extension).
 */
export function downloadScheduleAsCsv(
  schedule: ExportableTable,
  options: ScheduleExportOptions,
  translateHeader: HeaderTranslator,
): void {
  const csv = scheduleToCsv(schedule, options, translateHeader);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerExportDownload({ blob, filename: `${options.filename}.csv` });
}
