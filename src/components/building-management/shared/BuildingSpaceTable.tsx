/**
 * BuildingSpaceTable — Centralized sortable table component
 *
 * Used by all building space tabs (Units, Parking, Storage).
 * Renders data using the canonical @/components/ui/table system
 * with centralized border tokens and interactive patterns.
 *
 * Columns with a `sortValue` function get a clickable header
 * that toggles A→Z / Z→A sorting.
 *
 * @module components/building-management/shared/BuildingSpaceTable
 */

'use client';

import { Fragment, useMemo, useState, useCallback, type ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { BuildingSpaceActions } from './BuildingSpaceActions';
import type { SpaceColumn, SpaceActions, SpaceActionState, SortDirection } from './types';

// ============================================================================
// SORT STATE
// ============================================================================

interface SortState {
  key: string;
  direction: SortDirection;
}

// ============================================================================
// TYPES
// ============================================================================

interface BuildingSpaceTableProps<T> {
  /** Data items to display */
  items: T[];
  /** Column definitions */
  columns: SpaceColumn<T>[];
  /** Extract unique key from each item */
  getKey: (item: T) => string;
  /** Action handlers (view, edit, unlink, delete) */
  actions?: SpaceActions<T>;
  /** Loading state for action icons */
  actionState?: SpaceActionState;
  /** Custom render for inline editing (replaces the row content when editing) */
  renderEditRow?: (item: T) => React.ReactNode;
  /** ID of the item currently being edited inline */
  editingId?: string | null;
  /** ID of the currently expanded row (for inline floorplans) */
  expandedId?: string | null;
  /** Toggle expand for a row */
  onToggleExpand?: (id: string) => void;
  /** Render expanded content below the row (e.g. floorplan inline) */
  renderExpandedContent?: (item: T) => ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BuildingSpaceTable<T>({
  items,
  columns,
  getKey,
  actions,
  actionState,
  renderEditRow,
  editingId,
  expandedId,
  onToggleExpand,
  renderExpandedContent,
}: BuildingSpaceTableProps<T>) {
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();

  const hasActions = actions && (actions.onView || actions.onEdit || actions.onUnlink || actions.onDelete);

  // ============================================================================
  // SORT STATE & LOGIC
  // ============================================================================

  const [sort, setSort] = useState<SortState | null>(null);

  const handleSort = useCallback((columnKey: string) => {
    setSort((prev) => {
      if (prev?.key === columnKey) {
        return { key: columnKey, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key: columnKey, direction: 'asc' };
    });
  }, []);

  const sortedItems = useMemo(() => {
    if (!sort) return items;

    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return items;

    const { direction } = sort;
    const extractor = column.sortValue;

    return [...items].sort((a, b) => {
      const av = extractor(a);
      const bv = extractor(b);

      // Numeric comparison
      if (typeof av === 'number' && typeof bv === 'number') {
        return direction === 'asc' ? av - bv : bv - av;
      }

      // String comparison (locale-aware for Greek)
      const sa = String(av).toLowerCase();
      const sb = String(bv).toLowerCase();
      const cmp = sa.localeCompare(sb, 'el');
      return direction === 'asc' ? cmp : -cmp;
    });
  }, [items, sort, columns]);

  // ============================================================================
  // SORT ICON HELPER
  // ============================================================================

  const renderSortIcon = (columnKey: string) => {
    if (sort?.key === columnKey) {
      return sort.direction === 'asc'
        ? <ArrowUp className={`${iconSizes.xs} ml-1 inline-block`} />
        : <ArrowDown className={`${iconSizes.xs} ml-1 inline-block`} />;
    }
    return <ArrowUpDown className={`${iconSizes.xs} ml-1 inline-block opacity-40`} />;
  };

  // ============================================================================
  // EXPAND SUPPORT
  // ============================================================================

  const isExpandable = !!renderExpandedContent;
  const totalCols = columns.length + (isExpandable ? 1 : 0) + (hasActions ? 1 : 0);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {isExpandable && <TableHead className="w-10" />}
          {columns.map((col) => {
            const isSortable = !!col.sortValue;

            return (
              <TableHead
                key={col.key}
                className={`${col.width || ''} ${col.alignRight ? 'text-right' : ''} ${isSortable ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
                onClick={isSortable ? () => handleSort(col.key) : undefined}
              >
                {col.label}
                {isSortable && renderSortIcon(col.key)}
              </TableHead>
            );
          })}
          {hasActions && (
            <TableHead className="w-36 text-right">
              {t('spaceActions.actions')}
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedItems.map((item) => {
          const key = getKey(item);
          const isEditing = editingId === key;
          const isExpanded = expandedId === key;

          // If inline editing is active for this row, render custom edit row
          if (isEditing && renderEditRow) {
            return (
              <TableRow key={key}>
                {isExpandable && <TableCell />}
                {renderEditRow(item)}
              </TableRow>
            );
          }

          return (
            <Fragment key={key}>
              <TableRow>
                {isExpandable && (
                  <TableCell className="w-10 p-0 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onToggleExpand?.(key)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                      }
                    </Button>
                  </TableCell>
                )}
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={col.alignRight ? 'text-right' : ''}
                  >
                    {col.render(item)}
                  </TableCell>
                ))}
                {hasActions && (
                  <TableCell className="text-right">
                    <BuildingSpaceActions
                      onView={actions.onView ? () => actions.onView?.(item) : undefined}
                      onEdit={actions.onEdit ? () => actions.onEdit?.(item) : undefined}
                      onUnlink={actions.onUnlink ? () => actions.onUnlink?.(item) : undefined}
                      onDelete={actions.onDelete ? () => actions.onDelete?.(item) : undefined}
                      isUnlinking={actionState?.unlinkingId === key}
                      isDeleting={actionState?.deletingId === key}
                    />
                  </TableCell>
                )}
              </TableRow>
              {isExpandable && isExpanded && (
                <TableRow>
                  <TableCell colSpan={totalCols} className="bg-muted/30 p-2">
                    {renderExpandedContent(item)}
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
