/* eslint-disable design-system/prefer-design-system-imports */
/**
 * PropertyInlineEditRow — Inline edit row renderer for the properties table.
 *
 * Extracted from PropertiesTabContent.tsx for SRP compliance (CLAUDE.md N.7.1).
 * Encapsulates the table-cell based edit form that appears when a property row
 * enters inline edit mode via usePropertyInlineEdit.
 *
 * @module components/building-management/tabs/PropertyInlineEditRow
 * @since 2026-04-05
 */
'use client';

import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import type { PropertyType } from '@/types/property';
import type { TFunction } from 'i18next';
import {
  UNIT_TYPES_FOR_FILTER,
  UNIT_STATUSES_FOR_FILTER,
  getPropertyTypeLabel,
  getPropertyStatusLabel,
} from './property-tab-constants';
import type { usePropertyInlineEdit } from './usePropertyInlineEdit';

interface PropertyInlineEditRowProps {
  /** Inline edit controller returned from usePropertyInlineEdit */
  edit: ReturnType<typeof usePropertyInlineEdit>;
  /** Translation function scoped to 'properties' namespace */
  tUnits: TFunction;
}

export function PropertyInlineEditRow({ edit, tUnits }: PropertyInlineEditRowProps) {
  return (
    <>
      <TableCell>
        <Input
          value={edit.editName}
          onChange={(e) => edit.setEditName(e.target.value)}
          className="h-8"
          disabled={edit.saving}
        />
      </TableCell>
      <TableCell>
        <Select
          value={edit.editType || 'apartment'}
          onValueChange={(v) => edit.setEditType(v as PropertyType)}
          disabled={edit.saving}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNIT_TYPES_FOR_FILTER.map((ut) => (
              <SelectItem key={ut} value={ut}>
                {getPropertyTypeLabel(ut, tUnits)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={edit.editFloor}
          onChange={(e) => edit.setEditFloor(e.target.value)}
          className="h-8 w-16"
          disabled={edit.saving}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={edit.editArea}
          onChange={(e) => edit.setEditArea(e.target.value)}
          className="h-8 w-16"
          disabled={edit.saving}
        />
      </TableCell>
      <TableCell>
        <Select value={edit.editStatus} onValueChange={edit.setEditStatus} disabled={edit.saving}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNIT_STATUSES_FOR_FILTER.map((us) => (
              <SelectItem key={us} value={us}>
                {getPropertyStatusLabel(us, tUnits)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <nav className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={edit.handleSaveEdit}
            disabled={edit.saving || !edit.editName.trim()}
          >
            {edit.saving ? (
              <Spinner size="small" color="inherit" />
            ) : (
              <Check className="h-3.5 w-3.5 text-green-500" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={edit.cancelEdit}
            disabled={edit.saving}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </nav>
      </TableCell>
    </>
  );
}
