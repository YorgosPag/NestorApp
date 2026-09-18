/**
 * BuildingSpaceTable — Centralized sortable table component
 *
 * Used by all building space tabs (Units, Parking, Storage).
 * Renders data using the canonical @/components/ui/table system
 * with centralized border tokens and interactive patterns.
 *
 * Columns with a `sortValue` function get a clickable header
 * that toggles A→Z / Z→A sorting. Columns with `sortGroups` sort in GROUPS
 * (Revit `Sort By` group → `Then By` value) — ADR-777 §8.60.14.14.
 *
 * @module components/building-management/shared/BuildingSpaceTable
 */

'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { BuildingSpaceActions } from './BuildingSpaceActions';
import type { SpaceColumn, SpaceActions, SpaceActionState, SpaceSortGroup, SortDirection } from './types';
import { compareSortValues } from '@/lib/array-utils';
import '@/lib/design-system';

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
}

// ============================================================================
// SORT → GROUPS
// ============================================================================

/**
 * Οι γραμμές του πίνακα ως **ομάδες**, ταξινομημένες.
 *
 * - Στήλη με `sortGroups` ⇒ **εκείνη** διαμερίζει (Revit `Sort By` ομάδα → `Then By` τιμή):
 *   στοιχεία δύο ομάδων **δεν συγκρίνονται ποτέ** (ADR-777 §8.60.14.14 — τιμή πώλησης, €/μήνα
 *   και €/νύχτα δεν είναι ένας άξονας).
 * - Στήλη με `sortValue` ⇒ **μία** ομάδα χωρίς επιγραφή, με τον ΕΝΑ συγκριτή της εφαρμογής
 *   (κενά τελευταία και στις δύο κατευθύνσεις, ελληνική σειρά — `lib/array-utils`).
 */
function sortIntoGroups<T>(
  items: readonly T[],
  columns: readonly SpaceColumn<T>[],
  sort: SortState | null,
): readonly SpaceSortGroup<T>[] {
  const column = sort ? columns.find((c) => c.key === sort.key) : undefined;
  if (!sort || !column) return [{ key: 'all', label: null, items }];

  if (column.sortGroups) return column.sortGroups(items, sort.direction);

  const extractor = column.sortValue;
  if (!extractor) return [{ key: 'all', label: null, items }];
  const sorted = [...items].sort((a, b) => compareSortValues(extractor(a), extractor(b), sort.direction));
  return [{ key: 'all', label: null, items: sorted }];
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
}: BuildingSpaceTableProps<T>) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
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

  const sortedGroups = useMemo(() => sortIntoGroups(items, columns, sort), [items, sort, columns]);

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

  const columnCount = columns.length + (hasActions ? 1 : 0);

  const renderRow = (item: T) => {
    const key = getKey(item);

    // If inline editing is active for this row, render custom edit row
    if (editingId === key && renderEditRow) {
      return <TableRow key={key}>{renderEditRow(item)}</TableRow>;
    }

    return (
      <TableRow key={key}>
        {columns.map((col) => (
          <TableCell key={col.key} className={col.alignRight ? 'text-right' : ''}>
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
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => {
            const isSortable = !!col.sortValue || !!col.sortGroups;

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
      {sortedGroups.map((group) => (
        <TableBody key={group.key}>
          {group.label !== null && (
            <TableRow>
              {/* Γραμμή-επικεφαλίδα ομάδας (Revit `Sort By` header): `<th scope="rowgroup">`
                  δηλώνει στον αναγνώστη οθόνης ότι οι γραμμές από κάτω είναι ΜΙΑ κλάση. */}
              <TableHead scope="rowgroup" colSpan={columnCount} className="text-xs font-semibold uppercase tracking-wide">
                {group.label}
              </TableHead>
            </TableRow>
          )}
          {group.items.map(renderRow)}
        </TableBody>
      ))}
    </Table>
  );
}
