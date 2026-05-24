/**
 * Performance Diagnostics — CSV Exporter (ADR-366 §C.7.Q2)
 *
 * Pure-function serializer + browser download wrapper for the super-admin
 * BIM diagnostics dashboard. Mirrors `scheduleToCsv` (ADR-363) for cell
 * escaping and BOM handling.
 *
 * @module lib/exports/diagnostics-csv
 */

import { Timestamp } from 'firebase/firestore';
import { nowISO } from '@/lib/date-local';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import type { PerformanceDiagnostic, TriageStatus } from '@/types/performance-diagnostic';

export type HeaderTranslator = (key: string) => string;
export type StatusTranslator = (status: TriageStatus) => string;

function escapeCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatTimestamp(value: Timestamp | string | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  try {
    return value.toDate().toISOString();
  } catch {
    return '';
  }
}

function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2);
}

const COLUMN_KEYS = [
  'list.timestamp',
  'list.user',
  'list.project',
  'list.status',
  'list.fps',
  'list.mode',
  'list.assignee',
] as const;

export interface DiagnosticsCsvOptions {
  title: string;
  filename: string;
  translateHeader: HeaderTranslator;
  translateStatus: StatusTranslator;
}

export function diagnosticsToCsv(
  rows: ReadonlyArray<PerformanceDiagnostic>,
  options: DiagnosticsCsvOptions,
): string {
  const { title, translateHeader, translateStatus } = options;
  const lines: string[] = [];

  lines.push(escapeCell(title));
  lines.push(escapeCell(`Ημ. Εξαγωγής: ${nowISO().slice(0, 10)}`));
  lines.push('');

  const headerRow = COLUMN_KEYS.map((k) => escapeCell(translateHeader(k))).join(',');
  lines.push(headerRow);

  for (const row of rows) {
    const fps = row.metrics?.fps;
    const cells = [
      formatTimestamp(row.createdAt),
      row.userId ?? '',
      row.projectId ?? '',
      translateStatus(row.status ?? 'new'),
      formatMetric(typeof fps === 'number' ? fps : null),
      row.renderMode ?? '',
      row.assignedSuperAdminId ?? '',
    ];
    lines.push(cells.map((c) => escapeCell(c)).join(','));
  }

  return `﻿${lines.join('\r\n')}`;
}

export function downloadDiagnosticsCsv(
  rows: ReadonlyArray<PerformanceDiagnostic>,
  options: DiagnosticsCsvOptions,
): void {
  const csv = diagnosticsToCsv(rows, options);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerExportDownload({ blob, filename: `${options.filename}.csv` });
}
