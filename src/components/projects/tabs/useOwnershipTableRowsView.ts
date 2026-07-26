'use client';

/**
 * ADR-235: Ownership Table — group → filter → sort view pipeline.
 *
 * Extracted from OwnershipTableTab so the component stays a renderer: the three
 * derivations feed each other in a fixed order (rows are grouped per building,
 * the grouping is filtered, the filtered result is sorted), and keeping them in
 * one hook is what makes that order a fact instead of a convention.
 *
 * @module components/projects/tabs/useOwnershipTableRowsView
 */

import { useState, useCallback, useMemo } from 'react';
import { matchesSearchTerm } from '@/lib/search/search';
import type { MutableOwnershipTableRow } from '@/types/ownership-table';
import type { SortDirection } from '@/components/building-management/shared/types';
import type { OwnershipColumnDef } from '@/components/projects/tabs/ownership-table-config';

type RowGroups = Map<string, MutableOwnershipTableRow[]>;

export interface OwnershipTableRowsView {
  /** Rows grouped per building, filtered by the active column filters, then sorted. */
  sortedGroupedRows: RowGroups;
  columnFilters: Record<string, string>;
  updateColumnFilter: (col: string, value: string) => void;
  sortColumn: string | null;
  sortDirection: SortDirection;
  toggleSort: (col: string) => void;
}

export function useOwnershipTableRowsView(
  rows: MutableOwnershipTableRow[] | undefined,
  columns: OwnershipColumnDef[],
): OwnershipTableRowsView {
  const groupedRows = useMemo<RowGroups>(() => {
    if (!rows?.length) return new Map();
    const groups: RowGroups = new Map();
    for (const row of rows) {
      const group = groups.get(row.buildingId);
      if (group) group.push(row);
      else groups.set(row.buildingId, [row]);
    }
    return groups;
  }, [rows]);

  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const updateColumnFilter = useCallback((col: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [col]: value }));
  }, []);

  const hasActiveFilters = Object.values(columnFilters).some(v => v.trim() !== '');

  const filteredGroupedRows = useMemo<RowGroups>(() => {
    if (!hasActiveFilters) return groupedRows;
    const filtered: RowGroups = new Map();
    for (const [buildingId, buildingRows] of groupedRows) {
      const matchingRows = buildingRows.filter(row => {
        for (const col of columns) {
          const filterValue = columnFilters[col.key];
          if (!filterValue || !col.filterable || !col.sortValue) continue;
          if (!matchesSearchTerm([String(col.sortValue(row))], filterValue)) return false;
        }
        return true;
      });
      if (matchingRows.length > 0) filtered.set(buildingId, matchingRows);
    }
    return filtered;
  }, [groupedRows, columnFilters, hasActiveFilters, columns]);

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const toggleSort = useCallback((col: string) => {
    setSortColumn(prev => {
      if (prev === col) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return col;
      }
      setSortDirection('asc');
      return col;
    });
  }, []);

  const sortedGroupedRows = useMemo<RowGroups>(() => {
    if (!sortColumn) return filteredGroupedRows;
    const colDef = columns.find(c => c.key === sortColumn);
    if (!colDef?.sortValue) return filteredGroupedRows;
    const extractor = colDef.sortValue;
    const sorted: RowGroups = new Map();
    for (const [buildingId, buildingRows] of filteredGroupedRows) {
      const sortedRows = [...buildingRows].sort((a, b) => {
        const av = extractor(a);
        const bv = extractor(b);
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDirection === 'asc' ? av - bv : bv - av;
        }
        const cmp = String(av).localeCompare(String(bv), 'el');
        return sortDirection === 'asc' ? cmp : -cmp;
      });
      sorted.set(buildingId, sortedRows);
    }
    return sorted;
  }, [filteredGroupedRows, sortColumn, sortDirection, columns]);

  return {
    sortedGroupedRows,
    columnFilters,
    updateColumnFilter,
    sortColumn,
    sortDirection,
    toggleSort,
  };
}
