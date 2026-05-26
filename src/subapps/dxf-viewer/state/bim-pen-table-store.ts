'use client';

/**
 * ADR-375 Phase C.1 — BIM Pen Table Store (Zustand, Firestore-persisted).
 *
 * SSoT for per-company pen table overrides (16 pens × 6 scale columns).
 * Singleton doc: `dxf_viewer_pen_tables/{companyId}`.
 *
 * On load/update: calls `setPenTableSource()` to inject the effective table
 * into the resolver — no renderer changes needed.
 *
 * Non-React consumers: use `useBimPenTableStore.getState()`.
 * React consumers:    use `useBimPenTableStore((s) => s.<field>)`.
 *
 * Mount: call `loadForCompany(companyId)` once when the company context loads
 * (see `useBimPenTableSync` hook).
 */
import { create } from 'zustand';
import { setPenTableSource } from '../config/bim-line-weight-resolver';
import {
  buildEffectivePenTable,
  isValidPenMm,
  type EffectivePenTable,
  type PenTableOverrides,
} from '../config/bim-pen-table-types';
import { PEN_TABLE_MM, type PenIndex } from '../config/bim-pen-table';
import {
  savePenTableOverrides,
  subscribePenTableOverrides,
} from '../services/bim-pen-table.service';
import type { ConcreteLineweightMm } from '../config/lineweight-iso-catalog';

// ── Debounce helper ────────────────────────────────────────────────────────

type Timer = ReturnType<typeof setTimeout>;
let _pendingSave: Timer | null = null;

function debounceSave(companyId: string, overrides: PenTableOverrides, delayMs = 500): void {
  if (_pendingSave) clearTimeout(_pendingSave);
  _pendingSave = setTimeout(() => {
    _pendingSave = null;
    savePenTableOverrides(companyId, overrides).catch(() => {});
  }, delayMs);
}

// ── State shape ────────────────────────────────────────────────────────────

interface BimPenTableState {
  /** Sparse overrides (only changed cells). null = not yet loaded. */
  overrides: PenTableOverrides | null;
  /** Fully-resolved 16×6 table (defaults + overrides). */
  effectivePenTable: EffectivePenTable;
  /** Company this table belongs to. null = not loaded. */
  currentCompanyId: string | null;

  /** Subscribe to Firestore and hydrate the store. Returns unsubscribe fn. */
  loadForCompany: (companyId: string) => () => void;

  /**
   * Override a single cell.
   * Validates that mm is in the ISO catalog — silently ignores invalid values.
   */
  setCell: (penIdx: PenIndex, scaleColIdx: number, mm: number) => void;

  /** Remove override for a single cell (reverts to PEN_TABLE_MM default). */
  resetCell: (penIdx: PenIndex, scaleColIdx: number) => void;

  /** Clear all overrides for the current company. */
  resetAll: () => void;
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useBimPenTableStore = create<BimPenTableState>((set, get) => {
  function applyOverrides(overrides: PenTableOverrides | null): void {
    const effective = buildEffectivePenTable(overrides ?? undefined);
    setPenTableSource(effective);
    set({ overrides: overrides ?? {}, effectivePenTable: effective });
  }

  return {
    overrides: null,
    effectivePenTable: PEN_TABLE_MM,
    currentCompanyId: null,

    loadForCompany(companyId) {
      set({ currentCompanyId: companyId });
      const unsubscribe = subscribePenTableOverrides(companyId, (overrides) => {
        applyOverrides(overrides);
      });
      return unsubscribe;
    },

    setCell(penIdx, scaleColIdx, mm) {
      if (!isValidPenMm(mm)) return;
      const state = get();
      const existing = state.overrides ?? {};
      const penRow = existing[penIdx] ?? {};
      const nextRow = { ...penRow, [scaleColIdx]: mm as ConcreteLineweightMm };
      const nextOverrides: PenTableOverrides = { ...existing, [penIdx]: nextRow };
      applyOverrides(nextOverrides);
      if (state.currentCompanyId) debounceSave(state.currentCompanyId, nextOverrides);
    },

    resetCell(penIdx, scaleColIdx) {
      const state = get();
      const existing = state.overrides ?? {};
      const penRow = { ...existing[penIdx] };
      delete penRow[scaleColIdx];
      const nextOverrides: PenTableOverrides = { ...existing };
      if (Object.keys(penRow).length > 0) {
        nextOverrides[penIdx] = penRow;
      } else {
        delete nextOverrides[penIdx];
      }
      applyOverrides(nextOverrides);
      if (state.currentCompanyId) debounceSave(state.currentCompanyId, nextOverrides);
    },

    resetAll() {
      const { currentCompanyId } = get();
      applyOverrides({});
      if (currentCompanyId) {
        savePenTableOverrides(currentCompanyId, {}).catch(() => {});
      }
    },
  };
});
