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

import { normalizePropertyType } from '@/constants/property-type-aliases';
import { Input } from '@/components/ui/input';
import { TableCell } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TFunction } from 'i18next';
import {
  UNIT_TYPES_FOR_FILTER,
  UNIT_STATUSES_FOR_FILTER,
  getPropertyTypeLabel,
  getPropertyStatusLabel,
} from './property-tab-constants';
import type { Property } from '@/types/property';
import { SpacePriceCell } from '../shared/buildingSpacePriceColumn';
import { BuildingSpaceEditActions } from '../shared/BuildingSpaceActions';
import type { usePropertyInlineEdit } from './usePropertyInlineEdit';

interface PropertyInlineEditRowProps {
  /** Inline edit controller returned from usePropertyInlineEdit */
  edit: ReturnType<typeof usePropertyInlineEdit>;
  /** Translation function scoped to 'properties' namespace */
  tUnits: TFunction;
  /** Η μονάδα της γραμμής — για τα κελιά που δεν επεξεργάζονται επί τόπου (τιμή). */
  unit: Property;
}

export function PropertyInlineEditRow({ edit, tUnits, unit }: PropertyInlineEditRowProps) {
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
          // 🔴 Κανονικοποίηση αντί για ισχυρισμό (ADR-842 §7.6.12) — το Radix Select
          //    δίνει `string`. Μη αναγνωρίσιμη τιμή **δεν** αλλάζει το είδος.
          onValueChange={(v) => {
            const canonical = normalizePropertyType(v);
            if (canonical !== null) edit.setEditType(canonical);
          }}
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
      {/* Η τιμή δεν αλλάζει επί τόπου — φαίνεται στη θέση της, ώστε κάθε κελί να μένει κάτω από τη στήλη του. */}
      <TableCell>
        <SpacePriceCell item={unit} t={tUnits} />
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
        <BuildingSpaceEditActions
          onSave={edit.handleSaveEdit}
          onCancel={edit.cancelEdit}
          saving={edit.saving}
          canSave={Boolean(edit.editName.trim())}
        />
      </TableCell>
    </>
  );
}
