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
 * ADR-898 Φ4β: `initialSort` (το schedule ανοίγει ήδη ομαδοποιημένο, όπως το `Sort By` του Revit) και
 * `renderFooter` (`<tfoot>` — η γραμμή «Grand total» του schedule· ο καλών αποφασίζει αν **υπάρχει** σύνολο).
 * Οι επικεφαλίδες ταξινόμησης είναι **κουμπιά** με `aria-sort` — προσβάσιμες από πληκτρολόγιο.
 *
 * @module components/building-management/shared/BuildingSpaceTable
 */

'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { BuildingSpaceActions } from './BuildingSpaceActions';
import type { SpaceColumn, SpaceActions, SpaceActionState } from './types';
import { ariaSortOf, nextSortState, sortIntoGroups, type SortState } from './space-table-sort';
import '@/lib/design-system';

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
  /** Η ταξινόμηση με την οποία ανοίγει ο πίνακας (π.χ. ομάδες ανά όροφο). Ο άνθρωπος την αλλάζει κανονικά. */
  initialSort?: SortState;
  /** Ειδοποίηση σε κάθε αλλαγή ταξινόμησης — ώστε η εξαγωγή να βγάζει **ό,τι βλέπει** ο άνθρωπος, με την ίδια σειρά. */
  onSortChange?: (sort: SortState | null) => void;
  /** Γραμμή(ές) του `<tfoot>` — δέχεται το πλήθος στηλών για `colSpan`. Χωρίς αυτό: κανένα `<tfoot>`. */
  renderFooter?: (layout: { readonly columnCount: number }) => React.ReactNode;
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
  initialSort,
  onSortChange,
  renderFooter,
}: BuildingSpaceTableProps<T>) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const iconSizes = useIconSizes();

  const hasActions = actions && (actions.onView || actions.onEdit || actions.onUnlink || actions.onDelete);

  // ============================================================================
  // SORT STATE & LOGIC
  // ============================================================================

  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);

  const handleSort = useCallback((columnKey: string) => {
    const next = nextSortState(sort, columnKey);
    setSort(next);
    onSortChange?.(next);
  }, [sort, onSortChange]);

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
                className={`${col.width || ''} ${col.alignRight ? 'text-right' : ''}`}
                aria-sort={isSortable ? ariaSortOf(sort, col.key) : undefined}
              >
                {isSortable ? (
                  <button
                    type="button"
                    className="inline-flex items-center select-none hover:text-foreground"
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    {renderSortIcon(col.key)}
                  </button>
                ) : (
                  col.label
                )}
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
      {renderFooter && <TableFooter>{renderFooter({ columnCount })}</TableFooter>}
    </Table>
  );
}
