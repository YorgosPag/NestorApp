/**
 * BuildingSpaceTable — Centralized table component
 *
 * Used by all building space tabs (Units, Parking, Storage).
 * Renders data using the canonical @/components/ui/table system
 * with centralized border tokens and interactive patterns.
 *
 * @module components/building-management/shared/BuildingSpaceTable
 */

'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { BuildingSpaceActions } from './BuildingSpaceActions';
import type { SpaceColumn, SpaceActions, SpaceActionState } from './types';

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
  const { t } = useTranslation('building');

  const hasActions = actions && (actions.onView || actions.onEdit || actions.onUnlink || actions.onDelete);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={`${col.width || ''} ${col.alignRight ? 'text-right' : ''}`}
            >
              {col.label}
            </TableHead>
          ))}
          {hasActions && (
            <TableHead className="w-36 text-right">
              {t('spaceActions.actions')}
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const key = getKey(item);
          const isEditing = editingId === key;

          // If inline editing is active for this row, render custom edit row
          if (isEditing && renderEditRow) {
            return (
              <TableRow key={key}>
                {renderEditRow(item)}
              </TableRow>
            );
          }

          return (
            <TableRow key={key}>
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
          );
        })}
      </TableBody>
    </Table>
  );
}
