'use client';

/**
 * @fileoverview Report Table — Generic Comparative Table (Phase 2e)
 * @description Renders flattened report data with sorting support
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e (Q7 — comparative columns)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, semantic HTML
 */

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReportType, ReportDataMap } from '@/subapps/accounting/types';
import { cellFormatOf, flattenReportForExport } from '../../services/export/report-table-adapter';
import type { CellValue, ReportValueFormat } from '../../services/export/report-table-adapter';
import { formatReportCell, formatReportChange, formatReportNumber } from '../../services/export/report-cell-format';

// ============================================================================
// TYPES
// ============================================================================

interface ReportTableProps {
  reportType: ReportType;
  data: ReportDataMap[ReportType];
}

interface SortConfig {
  columnIndex: number;
  direction: 'asc' | 'desc';
}

// ============================================================================
// HELPERS
// ============================================================================

// 🔴 2026-10-30: η μορφή ερχόταν από τη ΘΕΣΗ της στήλης (τελευταία = «%», προτελευταία = μεταβολή) — το Υπόλοιπο
// του ισοζυγίου και το Σύνολο της ηλικίωσης έβγαιναν ποσοστό, τα πλήθη ευρώ. Τώρα: `cellFormatOf` (ρόλος στήλης +
// μορφή γραμμής), ο ίδιος κριτής με το PDF και το Excel.

function getCellAlignment(value: CellValue): string {
  if (typeof value === 'number') return 'text-right';
  return 'text-left';
}

function compareCells(a: CellValue, b: CellValue): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'el');
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
  return direction === 'asc'
    ? <ArrowUp className="ml-1 h-3 w-3" />
    : <ArrowDown className="ml-1 h-3 w-3" />;
}

function ChangeCell({ value, format }: { value: CellValue; format: ReportValueFormat }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof value !== 'number') return <span>{value}</span>;

  if (value === 0) return <span className="text-muted-foreground">0</span>;
  return (
    <Badge variant={value > 0 ? 'success' : 'destructive'} className="text-xs">
      {formatReportChange(value, format, 'screen')}
    </Badge>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ReportTable({ reportType, data }: ReportTableProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const tableData = useMemo(
    () => flattenReportForExport(reportType, data, t),
    [reportType, data, t]
  );
  const { columns } = tableData;

  const sortedRows = useMemo(() => {
    if (!sortConfig) return tableData.rows;

    return [...tableData.rows].sort((a, b) => {
      // Don't sort section header rows
      if (a.section) return -1;
      if (b.section) return 1;

      const result = compareCells(a.cells[sortConfig.columnIndex], b.cells[sortConfig.columnIndex]);
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [tableData.rows, sortConfig]);

  const handleSort = useCallback((columnIndex: number) => {
    setSortConfig((prev) => {
      if (prev?.columnIndex === columnIndex) {
        return prev.direction === 'asc'
          ? { columnIndex, direction: 'desc' }
          : null;
      }
      return { columnIndex, direction: 'asc' };
    });
  }, []);

  return (
    <section aria-label={t(`reports.reportTypes.${reportType}`)}>
      {/* Summary Metrics */}
      {tableData.summaryMetrics.length > 0 && (
        <nav className="flex flex-wrap gap-4 mb-4">
          {tableData.summaryMetrics.map((metric) => (
            <article key={metric.label} className="flex items-center gap-2 rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">{metric.label}</span>
              <span className="text-sm font-semibold">{formatReportNumber(metric.value, metric.format, 'screen')}</span>
              {metric.change && metric.change.percentage !== null && (
                <Badge
                  variant={metric.change.percentage >= 0 ? 'success' : 'destructive'}
                  className="text-xs"
                >
                  {metric.change.percentage >= 0 ? '+' : ''}{metric.change.percentage.toFixed(1)}%
                </Badge>
              )}
            </article>
          ))}
        </nav>
      )}

      {/* Data Table */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column, i) => (
                <TableHead key={i}>
                  <button
                    type="button"
                    onClick={() => handleSort(i)}
                    className="flex items-center hover:text-foreground"
                  >
                    {column.header}
                    <SortIcon
                      active={sortConfig?.columnIndex === i}
                      direction={sortConfig?.direction ?? 'asc'}
                    />
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row, rowIdx) => {
              const isSection = row.section;
              return (
                <TableRow key={rowIdx} className={isSection ? 'bg-muted/50 font-semibold' : ''}>
                  {row.cells.map((cell, colIdx) => (
                    <TableCell
                      key={colIdx}
                      className={cn(
                        getCellAlignment(cell),
                        isSection && colIdx === 0 ? 'font-semibold' : ''
                      )}
                    >
                      {columns[colIdx].kind === 'change' ? (
                        <ChangeCell value={cell} format={row.format} />
                      ) : (
                        formatReportCell(cell, cellFormatOf(columns[colIdx], row), 'screen')
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
