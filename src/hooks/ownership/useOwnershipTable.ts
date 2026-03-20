/**
 * ============================================================================
 * ADR-235: useOwnershipTable Hook
 * ============================================================================
 *
 * Custom hook for ownership table state management.
 * Handles: fetch, mutations, calculations, save, finalize, unlock.
 *
 * @module hooks/ownership/useOwnershipTable
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  OwnershipPercentageTable,
  MutableOwnershipPercentageTable,
  MutableOwnershipTableRow,
  CalculationMethod,
  OwnerParty,
  OwnershipTableRevision,
  OwnershipValidationResult,
  LandownerEntry,
} from '@/types/ownership-table';
import { TOTAL_SHARES_TARGET } from '@/types/ownership-table';
import {
  getTable,
  createTable,
  saveTable,
  finalizeTable as finalizeTableService,
  unlockTable as unlockTableService,
  autoPopulateRows,
  getRevisions,
} from '@/services/ownership/ownership-table-service';
import {
  calculateByArea,
  calculateByValue,
  calculateByVolume,
  validateTotal,
  calculateCategorySummary,
  calculateBartexSummary,
} from '@/services/ownership/ownership-calculation-engine';
import { getErrorMessage } from '@/lib/error-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface UseOwnershipTableReturn {
  /** Current table state (mutable for editing) */
  table: MutableOwnershipPercentageTable | null;
  /** Loading state */
  loading: boolean;
  /** Saving state */
  saving: boolean;
  /** Error message */
  error: string | null;
  /** Validation result */
  validation: OwnershipValidationResult | null;
  /** Revision history */
  revisions: OwnershipTableRevision[];
  /** Whether table is locked (finalized/registered) */
  isLocked: boolean;

  // --- Actions ---
  /** Auto-populate rows from Firestore entities */
  autoPopulate: () => Promise<void>;
  /** Calculate millesimal shares with current method */
  calculate: (method?: CalculationMethod) => void;
  /** Update a specific cell in a row */
  updateRow: (index: number, field: keyof MutableOwnershipTableRow, value: string | number | boolean | OwnerParty) => void;
  /** Add a manual row */
  addRow: (row: MutableOwnershipTableRow) => void;
  /** Remove a row by index */
  removeRow: (index: number) => void;
  /** Update table-level fields */
  updateTableField: (field: string, value: string | number | null) => void;
  /** Save table to Firestore */
  save: () => Promise<void>;
  /** Finalize (lock) the table */
  finalize: (userId: string) => Promise<void>;
  /** Unlock a finalized table */
  unlock: (userId: string, reason: string) => Promise<void>;
  /** Reload table from Firestore */
  reload: () => Promise<void>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useOwnershipTable(
  projectId: string | undefined,
  buildingIds: string[],
): UseOwnershipTableReturn {
  const [table, setTable] = useState<MutableOwnershipPercentageTable | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<OwnershipValidationResult | null>(null);
  const [revisions, setRevisions] = useState<OwnershipTableRevision[]>([]);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const isLocked = table?.status === 'finalized' || table?.status === 'registered';

  // --- Validate rows when they change ---
  const runValidation = useCallback((rows: MutableOwnershipTableRow[]) => {
    if (rows.length > 0) {
      const result = validateTotal(rows);
      setValidation(result);
    } else {
      setValidation(null);
    }
  }, []);

  // --- Load table ---
  const loadTable = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      let existing = await getTable(projectId);

      if (!existing) {
        // Create new table
        existing = await createTable(projectId, buildingIds);
      }

      if (!isMounted.current) return;

      const mutable: MutableOwnershipPercentageTable = {
        ...existing,
        buildingIds: [...existing.buildingIds],
        rows: existing.rows.map(r => ({ ...r })),
        kaekCodes: existing.kaekCodes ? [...existing.kaekCodes] : null,
        summaryByCategory: { ...existing.summaryByCategory },
        bartex: existing.bartex ? { ...existing.bartex } : null,
      };

      setTable(mutable);
      runValidation([...mutable.rows]);

      // Load revisions
      const revs = await getRevisions(existing.id);
      if (isMounted.current) {
        setRevisions(revs);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(getErrorMessage(err, 'Failed to load ownership table'));
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [projectId, buildingIds, runValidation]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  // --- Auto-populate ---
  const autoPopulate = useCallback(async (): Promise<number> => {
    if (!projectId || !table) return 0;

    setLoading(true);
    setError(null);

    try {
      const rows = await autoPopulateRows(projectId, buildingIds);

      if (!isMounted.current) return 0;

      setTable(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          rows,
          buildingIds: [...buildingIds],
          totalShares: rows.reduce((sum, r) => sum + r.millesimalShares, 0),
          summaryByCategory: calculateCategorySummary(rows),
        };
      });

      runValidation(rows);
      return rows.length;
    } catch (err) {
      if (isMounted.current) {
        setError(getErrorMessage(err, 'Failed to auto-populate'));
      }
      return 0;
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [projectId, table, buildingIds, runValidation]);

  // --- Calculate ---
  const calculate = useCallback((method?: CalculationMethod) => {
    if (!table || table.rows.length === 0) return;

    const calcMethod = method ?? table.calculationMethod;
    let newRows: MutableOwnershipTableRow[];

    switch (calcMethod) {
      case 'value':
        newRows = calculateByValue(
          table.rows,
          table.zonePrice,
          table.commercialityCoefficient,
        );
        break;
      case 'volume':
        newRows = calculateByVolume(table.rows);
        break;
      case 'area':
      default:
        newRows = calculateByArea(table.rows);
        break;
    }

    setTable(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: newRows,
        calculationMethod: calcMethod,
        totalShares: newRows.reduce((sum, r) => sum + r.millesimalShares, 0),
        summaryByCategory: calculateCategorySummary(newRows),
      };
    });

    runValidation(newRows);
  }, [table, runValidation]);

  // --- Update row ---
  const updateRow = useCallback((
    index: number,
    field: keyof MutableOwnershipTableRow,
    value: string | number | boolean | OwnerParty,
  ) => {
    setTable(prev => {
      if (!prev) return prev;
      const newRows = [...prev.rows];
      const row = { ...newRows[index] };

      // Type-safe assignment
      switch (field) {
        case 'millesimalShares':
          row.millesimalShares = value as number;
          row.isManualOverride = true;
          break;
        case 'areaSqm':
          row.areaSqm = value as number;
          break;
        case 'heightM':
          row.heightM = value as number;
          break;
        case 'ownerParty':
          row.ownerParty = value as OwnerParty;
          break;
        case 'description':
          row.description = value as string;
          break;
        case 'entityCode':
          row.entityCode = value as string;
          break;
        case 'floor':
          row.floor = value as string;
          break;
        default:
          break;
      }

      newRows[index] = row;
      const totalShares = newRows.reduce((sum, r) => sum + r.millesimalShares, 0);

      runValidation(newRows);

      return {
        ...prev,
        rows: newRows,
        totalShares,
        summaryByCategory: calculateCategorySummary(newRows),
      };
    });
  }, [runValidation]);

  // --- Add row ---
  const addRow = useCallback((row: MutableOwnershipTableRow) => {
    setTable(prev => {
      if (!prev) return prev;
      const newRows = [...prev.rows, { ...row, ordinal: prev.rows.length + 1 }];
      runValidation(newRows);
      return {
        ...prev,
        rows: newRows,
        totalShares: newRows.reduce((sum, r) => sum + r.millesimalShares, 0),
        summaryByCategory: calculateCategorySummary(newRows),
      };
    });
  }, [runValidation]);

  // --- Remove row ---
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
        totalShares: newRows.reduce((sum, r) => sum + r.millesimalShares, 0),
        summaryByCategory: calculateCategorySummary(newRows),
      };
    });
  }, [runValidation]);

  // --- Update table-level field ---
  const updateTableField = useCallback((field: string, value: string | number | null) => {
    setTable(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  // --- Save ---
  const save = useCallback(async () => {
    if (!table) return;

    setSaving(true);
    setError(null);

    try {
      await saveTable(table);
      if (isMounted.current) {
        setSaving(false);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(getErrorMessage(err, 'Failed to save'));
        setSaving(false);
      }
    }
  }, [table]);

  // --- Finalize ---
  const finalize = useCallback(async (userId: string) => {
    if (!table) return;

    // Save first
    await save();

    setSaving(true);
    setError(null);

    try {
      await finalizeTableService(table.id, userId);
      if (isMounted.current) {
        setTable(prev => prev ? { ...prev, status: 'finalized' } : prev);
        // Reload revisions
        const revs = await getRevisions(table.id);
        if (isMounted.current) {
          setRevisions(revs);
          setSaving(false);
        }
      }
    } catch (err) {
      if (isMounted.current) {
        setError(getErrorMessage(err, 'Failed to finalize'));
        setSaving(false);
      }
    }
  }, [table, save]);

  // --- Unlock ---
  const unlock = useCallback(async (userId: string, reason: string) => {
    if (!table) return;

    setSaving(true);
    setError(null);

    try {
      await unlockTableService(table.id, userId, reason);
      if (isMounted.current) {
        setTable(prev =>
          prev ? { ...prev, status: 'draft', version: prev.version + 1 } : prev,
        );
        setSaving(false);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(getErrorMessage(err, 'Failed to unlock'));
        setSaving(false);
      }
    }
  }, [table]);

  // --- Reload ---
  const reload = useCallback(async () => {
    await loadTable();
  }, [loadTable]);

  return {
    table,
    loading,
    saving,
    error,
    validation,
    revisions,
    isLocked,
    autoPopulate,
    calculate,
    updateRow,
    addRow,
    removeRow,
    updateTableField,
    save,
    finalize,
    unlock,
    reload,
  };
}
