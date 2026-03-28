/**
 * useOwnershipRowMutations — Row manipulation sub-hook for useOwnershipTable
 * Extracted for file-size compliance (<500 lines per file).
 *
 * @module hooks/ownership/useOwnershipRowMutations
 */

import { useCallback } from 'react';
import type {
  MutableOwnershipPercentageTable,
  MutableOwnershipTableRow,
  OwnerParty,
} from '@/types/ownership-table';
import { calculateCategorySummary } from '@/services/ownership/ownership-calculation-engine';

// ============================================================================
// TYPES
// ============================================================================

type SetTableFn = React.Dispatch<React.SetStateAction<MutableOwnershipPercentageTable | null>>;
type RunValidationFn = (rows: MutableOwnershipTableRow[]) => void;
type SetIsDirtyFn = (dirty: boolean) => void;

interface UseOwnershipRowMutationsParams {
  setTable: SetTableFn;
  runValidation: RunValidationFn;
  setIsDirty: SetIsDirtyFn;
}

/** Helper: compute total shares from rows */
function computeTotalShares(rows: MutableOwnershipTableRow[]): number {
  return rows.filter(r => r.participatesInCalculation !== false).reduce((sum, r) => sum + r.millesimalShares, 0);
}

// ============================================================================
// HOOK
// ============================================================================

export function useOwnershipRowMutations({
  setTable,
  runValidation,
  setIsDirty,
}: UseOwnershipRowMutationsParams) {

  const updateRow = useCallback((
    index: number,
    field: keyof MutableOwnershipTableRow,
    value: string | number | boolean | OwnerParty,
  ) => {
    setTable(prev => {
      if (!prev) return prev;
      const newRows = [...prev.rows];
      const row = { ...newRows[index] };

      switch (field) {
        case 'millesimalShares':
          row.millesimalShares = value as number;
          row.isManualOverride = true;
          break;
        case 'areaSqm': row.areaSqm = value as number; break;
        case 'heightM': row.heightM = value as number; break;
        case 'ownerParty': row.ownerParty = value as OwnerParty; break;
        case 'description': row.description = value as string; break;
        case 'entityCode': row.entityCode = value as string; break;
        case 'floor': row.floor = value as string; break;
        default: break;
      }

      newRows[index] = row;
      runValidation(newRows);

      return {
        ...prev,
        rows: newRows,
        totalShares: computeTotalShares(newRows),
        summaryByCategory: calculateCategorySummary(newRows),
      };
    });
    setIsDirty(true);
  }, [setTable, runValidation, setIsDirty]);

  const updateLinkedSpace = useCallback((
    rowIndex: number,
    spaceIndex: number,
    field: 'hasOwnShares' | 'millesimalShares',
    value: boolean | number,
  ) => {
    setTable(prev => {
      if (!prev) return prev;
      const newRows = [...prev.rows];
      const row = { ...newRows[rowIndex] };
      if (!row.linkedSpacesSummary) return prev;

      const newSpaces = [...row.linkedSpacesSummary];
      const space = { ...newSpaces[spaceIndex] };

      if (field === 'hasOwnShares') {
        space.hasOwnShares = value as boolean;
        if (!value) space.millesimalShares = 0;
      } else {
        space.millesimalShares = value as number;
      }

      newSpaces[spaceIndex] = space;
      row.linkedSpacesSummary = newSpaces;
      newRows[rowIndex] = row;

      return { ...prev, rows: newRows };
    });
    setIsDirty(true);
  }, [setTable, setIsDirty]);

  const addRow = useCallback((row: MutableOwnershipTableRow) => {
    setTable(prev => {
      if (!prev) return prev;
      const newRows = [...prev.rows, { ...row, ordinal: prev.rows.length + 1 }];
      runValidation(newRows);
      return {
        ...prev,
        rows: newRows,
        totalShares: computeTotalShares(newRows),
        summaryByCategory: calculateCategorySummary(newRows),
      };
    });
  }, [setTable, runValidation]);

  const addAirRightsRow = useCallback(() => {
    setTable(prev => {
      if (!prev) return prev;
      const existingAirRights = prev.rows.filter(r => r.category === 'air_rights').length;
      const airRow: MutableOwnershipTableRow = {
        ordinal: prev.rows.length + 1,
        buildingId: prev.buildingIds?.[0] ?? '',
        buildingName: '',
        entityRef: { collection: 'units', id: `air_rights_${Date.now()}` },
        entityCode: `ΔΥ-${String(existingAirRights + 1).padStart(2, '0')}`,
        description: 'Δικαίωμα υψούν / αέρας',
        category: 'air_rights',
        floor: '—',
        areaNetSqm: 0,
        areaSqm: 0,
        heightM: null,
        millesimalShares: 0,
        isManualOverride: true,
        coefficients: null,
        participatesInCalculation: true,
        linkedSpacesSummary: null,
        ownerParty: 'unassigned',
        buyerContactId: null,
        buyerName: null,
        preliminaryContract: null,
        finalContract: null,
      };
      const newRows = [...prev.rows, airRow];
      runValidation(newRows);
      return {
        ...prev,
        rows: newRows,
        totalShares: computeTotalShares(newRows),
        summaryByCategory: calculateCategorySummary(newRows),
      };
    });
    setIsDirty(true);
  }, [setTable, runValidation, setIsDirty]);

  const removeRow = useCallback((index: number) => {
    setTable(prev => {
      if (!prev) return prev;
      const newRows = prev.rows
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, ordinal: i + 1 }));
      runValidation(newRows);
      return {
        ...prev,
        rows: newRows,
        totalShares: computeTotalShares(newRows),
        summaryByCategory: calculateCategorySummary(newRows),
      };
    });
  }, [setTable, runValidation]);

  return { updateRow, updateLinkedSpace, addRow, addAirRightsRow, removeRow };
}
