'use client';

/**
 * @module ReportTable
 * @enterprise ADR-265 — Sortable, paginated report table
 *
 * Wraps existing Table components with sort, pagination, and
 * automatic value formatting (currency/number/percentage/date).
 */

import '@/lib/design-system';
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSemanticColors } from '@/hooks/useSemanticColors';

import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatPercentage, formatDate } from '@/lib/intl-formatting';
import { ReportEmptyState } from './ReportEmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportColumnDef<T = Record<string, unknown>> {
  /** Object key to access value */
  key: string;
  /** Column header text */
  header: string;
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Auto-format value */
  format?: 'currency' | 'number' | 'percentage' | 'date' | 'text';
  /** Custom cell renderer */
  render?: (value: unknown, row: T) => React.ReactNode;
  /** Column width (CSS value) */
  width?: string;
}

export type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  key: string;
  direction: SortDirection;
}

export interface ReportTableProps<T = Record<string, unknown>> {
  /** Column definitions */
  columns: ReportColumnDef<T>[];
  /** Row data */
  data: T[];
  /** Rows per page (default: 10) */
  pageSize?: number;
  /** Show pagination (default: true) */
  showPagination?: boolean;
  /** Enable sorting (default: true) */
  sortable?: boolean;
  /** Initial sort */
  defaultSort?: SortState;
  /** Table density */
  size?: 'default' | 'compact';
  /** Empty state message */
  emptyMessage?: string;
  /** Show loading skeleton */
  loading?: boolean;
  /** Click handler for rows */
  onRowClick?: (row: T) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCellValue(value: unknown, format?: ReportColumnDef['format']): React.ReactNode {
  if (value === null || value === undefined) return '—';

  switch (format) {
    case 'currency':
      return formatCurrency(Number(value));
    case 'number':
      return formatNumber(Number(value));
    case 'percentage':
      return formatPercentage(Number(value));
    case 'date':
      return value instanceof Date
        ? formatDate(value)
        : formatDate(new Date(String(value)));
    case 'text':
    default:
      return String(value);
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportTable<T extends Record<string, unknown> = Record<string, unknown>>({
  columns,
  data,
  pageSize = 10,
  showPagination = true,
  sortable = true,
  defaultSort,
  size: _size = 'default',
  emptyMessage,
  loading = false,
  onRowClick,
  className,
}: ReportTableProps<T>) {
  const { t } = useTranslation('reports');
  const colors = useSemanticColors();

  // Sort state
  const [sortState, setSortState] = useState<SortState>(
    defaultSort ?? { key: '', direction: null },
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);

  // Handle sort toggle
  const handleSort = useCallback((key: string) => {
    setSortState((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: '', direction: null };
    });
    setCurrentPage(0);
  }, []);

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortState.key || !sortState.direction) return data;

    return [...data].sort((a, b) => {
      const aVal = getNestedValue(a, sortState.key);
      const bVal = getNestedValue(b, sortState.key);

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal), 'el');

      return sortState.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortState]);

  // Paginated data
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = showPagination
    ? sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : sortedData;

  // Loading skeleton
  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <ReportEmptyState
        type="no-data"
        description={emptyMessage ?? t('table.noData')}
        className={className}
      />
    );
  }

  const alignClass = (align?: string) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className={cn('space-y-3', className)}>
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(alignClass(col.align), col.width && `w-[${col.width}]`)}
                >
                  {sortable && col.sortable !== false ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 gap-1"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.header}
                      {sortState.key === col.key ? (
                        sortState.direction === 'asc'
                          ? <ArrowUp className="h-3.5 w-3.5" />
                          : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                      )}
                    </Button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, rowIndex) => (
              <TableRow
                key={rowIndex}
                className={cn(onRowClick && 'cursor-pointer')}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => {
                  const cellValue = getNestedValue(row, col.key);
                  return (
                    <TableCell key={col.key} className={alignClass(col.align)}>
                      {col.render
                        ? col.render(cellValue, row)
                        : formatCellValue(cellValue, col.format)
                      }
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <nav
          className="flex items-center justify-between px-1"
          aria-label="Pagination"
        >
          <p className={cn('text-sm', colors.text.muted)}>
            {t('table.page')} {currentPage + 1} {t('table.of')} {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">{t('table.previous')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <span className="sr-only">{t('table.next')}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
