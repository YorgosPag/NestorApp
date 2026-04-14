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
import { flattenReportForExport } from '../../services/export/report-table-adapter';
import type { CellValue } from '../../services/export/report-table-adapter';
import { formatCurrency } from '../../utils/format';

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

function formatCell(value: CellValue, colIndex: number, headerCount: number): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;

  // Last column is typically %, second-to-last is change
  const isPercentColumn = colIndex === headerCount - 1;
  if (isPercentColumn) return `${value.toFixed(1)}%`;

  return formatCurrency(value);
}

function getCellAlignment(value: CellValue): string {
  if (typeof value === 'number') return 'text-right';
  return 'text-left';
}

function isHeaderRow(row: CellValue[]): boolean {
  // Section headers have only the first cell set, rest are null
  const nonNullCount = row.filter((v) => v !== null).length;
  return nonNullCount === 1 && typeof row[0] === 'string';
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

function ChangeCell({ value }: { value: CellValue }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof value !== 'number') return <span>{value}</span>;

  if (value > 0) {
    return <Badge variant="success" className="text-xs">+{formatCurrency(value)}</Badge>;
  }
  if (value < 0) {
    return <Badge variant="destructive" className="text-xs">{formatCurrency(value)}</Badge>;
  }
  return <span className="text-muted-foreground">0</span>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ReportTable({ reportType, data }: ReportTableProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const tableData = useMemo(
    () => flattenReportForExport(reportType, data),
    [reportType, data]
  );

  const sortedRows = useMemo(() => {
    if (!sortConfig) return tableData.rows;

    return [...tableData.rows].sort((a, b) => {
      // Don't sort header rows
      if (isHeaderRow(a)) return -1;
      if (isHeaderRow(b)) return 1;

      const result = compareCells(a[sortConfig.columnIndex], b[sortConfig.columnIndex]);
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

  const isChangeColumn = (index: number) =>
    index === tableData.headers.length - 2;

  return (
    <section aria-label={t(`reports.reportTypes.${reportType}`)}>
      {/* Summary Metrics */}
      {tableData.summaryMetrics.length > 0 && (
        <nav className="flex flex-wrap gap-4 mb-4">
          {tableData.summaryMetrics.map((metric) => (
            <article key={metric.label} className="flex items-center gap-2 rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">{metric.label}</span>
              <span className="text-sm font-semibold">{formatCurrency(metric.value)}</span>
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
              {tableData.headers.map((header, i) => (
                <TableHead key={i}>
                  <button
                    type="button"
                    onClick={() => handleSort(i)}
                    className="flex items-center hover:text-foreground"
                  >
                    {header}
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
              const isSection = isHeaderRow(row);
              return (
                <TableRow key={rowIdx} className={isSection ? 'bg-muted/50 font-semibold' : ''}>
                  {row.map((cell, colIdx) => (
                    <TableCell
                      key={colIdx}
                      className={cn(
                        getCellAlignment(cell),
                        isSection && colIdx === 0 ? 'font-semibold' : ''
                      )}
                    >
                      {isChangeColumn(colIdx) ? (
                        <ChangeCell value={cell} />
                      ) : (
                        formatCell(cell, colIdx, tableData.headers.length)
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
