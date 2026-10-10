'use client';

/**
 * @fileoverview **Οι όροφοι ως πίνακας** — η όψη για φαρδύ χώρο (ADR-912 §5).
 * @related FloorsCompactList.tsx (η όψη για στενό χώρο) · floor-row-model.ts (η κοινή γραμμή)
 * @module components/building-management/tabs/floors/FloorsTable
 *
 * Ο πίνακας έχει επτά στήλες με σταθερά πλάτη (~560px ελάχιστο). Κάτω από αυτό **δεν** στριμώχνεται ούτε κυλά
 * οριζόντια: ο `FloorsTabContent` δείχνει τη λίστα.
 */

import { Fragment } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getStatusColor } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import type { Building } from '@/types/building/contracts';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { BuildingSpaceEditActions } from '../../shared/BuildingSpaceActions';
import { FloorElevationField, FloorHeightField, FloorNameField, FloorNumberField } from './floor-edit-fields';
import { buildFloorRowModel, floorRowTone, type FloorRowModel, type FloorsTabState } from './floor-row-model';
import { FloorExpandButton, FloorExpandedPanel, FloorHeightValue, FloorTitle, FloorViewActions } from './floor-row-parts';

const COLUMN_COUNT = 7;
const CELL = 'px-2 py-2';

interface FloorsTableProps {
  readonly state: FloorsTabState;
  readonly building: Building;
}

interface RowCellsProps {
  readonly row: FloorRowModel;
  readonly state: FloorsTabState;
}

function EditCells({ row, state }: RowCellsProps) {
  const colors = useSemanticColors();
  return (
    <>
      <td className={CELL}><FloorNumberField state={state} className="w-16" /></td>
      <td className={CELL}><FloorNameField state={state} /></td>
      <td className={CELL}><FloorElevationField state={state} className="w-24" /></td>
      <td className={CELL}><FloorHeightField state={state} row={row} className="w-20" /></td>
      <td className={cn(CELL, 'text-center', colors.text.muted)}>{row.floor.units ?? 0}</td>
      <td className={CELL}>
        <BuildingSpaceEditActions
          onSave={state.handleSaveEdit}
          onCancel={state.cancelEdit}
          saving={state.saving}
          canSave={Boolean(state.editName.trim())}
        />
      </td>
    </>
  );
}

function ViewCells({ row, state }: RowCellsProps) {
  const colors = useSemanticColors();
  const { floor } = row;
  return (
    <>
      <td className={cn(CELL, 'font-mono text-sm font-medium')}>{floor.number}</td>
      <td className={CELL}><FloorTitle row={row} state={state} /></td>
      <td className={cn(CELL, 'font-mono text-xs', colors.text.muted)}>{state.formatElevation(floor.elevation)}</td>
      <td className={cn(CELL, 'font-mono text-xs', row.isTooLow ? getStatusColor('error', 'text') : colors.text.muted)}>
        <FloorHeightValue row={row} />
      </td>
      <td className={cn(CELL, 'text-center', colors.text.muted)}>{floor.units ?? 0}</td>
      <td className={CELL}><FloorViewActions row={row} state={state} withFloorplanToggle /></td>
    </>
  );
}

export function FloorsTable({ state, building }: FloorsTableProps) {
  const { t } = useTranslation(['building-tabs']);
  const colors = useSemanticColors();

  return (
    <TooltipProvider delayDuration={300}>
      <table className="w-full text-sm">
        <thead>
          <tr className={cn('border-b border-border text-left text-xs font-medium uppercase', colors.text.muted)}>
            <th className="w-10 px-2 py-2" />
            <th className="w-20 px-2 py-2">{t('tabs.floors.number')}</th>
            <th className="px-2 py-2">{t('tabs.floors.name')}</th>
            <th className="w-32 px-2 py-2">{t('tabs.floors.elevation')}</th>
            <th className="w-24 px-2 py-2">{t('tabs.floors.height')}</th>
            <th className="w-20 px-2 py-2 text-center">{t('tabs.floors.units')}</th>
            <th className="w-32 px-2 py-2 text-right">{t('tabs.floors.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {state.floors.map((floor, index) => {
            const row = buildFloorRowModel(state, index);
            return (
              <Fragment key={floor.id}>
                <tr
                  ref={(el) => state.registerFloorRowRef(floor.id, el)}
                  className={cn('border-b border-border/50 transition-colors duration-700', floorRowTone(row))}
                >
                  <td className={CELL}><FloorExpandButton row={row} state={state} /></td>
                  {row.isEditing ? <EditCells row={row} state={state} /> : <ViewCells row={row} state={state} />}
                </tr>
                {row.isExpanded && (
                  <tr className="bg-muted/5">
                    <td colSpan={COLUMN_COUNT} className={CELL}>
                      <FloorExpandedPanel row={row} state={state} building={building} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </TooltipProvider>
  );
}
