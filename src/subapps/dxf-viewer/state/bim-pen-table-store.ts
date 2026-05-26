'use client';

/**
 * ADR-375 Phase C.1+C.2 — BIM Pen Table Store (Zustand, Firestore-persisted).
 *
 * SSoT for per-company pen table overrides (16 pens × 6 scale columns).
 * Singleton doc: `dxf_viewer_pen_tables/{companyId}`.
 *
 * Phase C.2 adds pen sets (Design / Construction / Presentation):
 * - `activePresetName` tracks which preset is active ('custom' after manual edits).
 * - `applyPreset(name)` replaces the full table in one shot + persists.
 * - `resetAll` restores defaults and sets preset → 'construction'.
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
  penSetToOverrides,
  type PenSetName,
} from '../config/bim-pen-sets';
import {
  savePenTableOverrides,
  subscribePenTableOverrides,
} from '../services/bim-pen-table.service';
import type { ConcreteLineweightMm } from '../config/lineweight-iso-catalog';

// ── Debounce helper ────────────────────────────────────────────────────────

type Timer = ReturnType<typeof setTimeout>;
let _pendingSave: Timer | null = null;

function debounceSave(
  companyId: string,
  overrides: PenTableOverrides,
  activePresetName: string,
  delayMs = 500,
): void {
  if (_pendingSave) clearTimeout(_pendingSave);
  _pendingSave = setTimeout(() => {
    _pendingSave = null;
    savePenTableOverrides(companyId, overrides, activePresetName).catch(() => {});
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
  /** Active pen set preset, or 'custom' after manual cell edits. */
  activePresetName: PenSetName | 'custom';

  /** Subscribe to Firestore and hydrate the store. Returns unsubscribe fn. */
  loadForCompany: (companyId: string) => () => void;

  /**
   * Override a single cell.
   * Validates that mm is in the ISO catalog — silently ignores invalid values.
   * Marks preset as 'custom'.
   */
  setCell: (penIdx: PenIndex, scaleColIdx: number, mm: number) => void;

  /** Remove override for a single cell (reverts to PEN_TABLE_MM default). Marks 'custom'. */
  resetCell: (penIdx: PenIndex, scaleColIdx: number) => void;

  /** Clear all overrides and revert preset to 'construction' (ISO defaults). */
  resetAll: () => void;

  /** Apply a built-in pen set preset — overwrites all cells, then persists. */
  applyPreset: (name: PenSetName) => void;
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useBimPenTableStore = create<BimPenTableState>((set, get) => {
  function applyOverrides(
    overrides: PenTableOverrides | null,
    presetName: PenSetName | 'custom' = 'custom',
  ): void {
    const effective = buildEffectivePenTable(overrides ?? undefined);
    setPenTableSource(effective);
    set({ overrides: overrides ?? {}, effectivePenTable: effective, activePresetName: presetName });
  }

  return {
    overrides: null,
    effectivePenTable: PEN_TABLE_MM,
    currentCompanyId: null,
    activePresetName: 'construction',

    loadForCompany(companyId) {
      set({ currentCompanyId: companyId });
      const unsubscribe = subscribePenTableOverrides(companyId, ({ overrides, activePresetName }) => {
        const preset = (activePresetName as PenSetName | 'custom') ?? 'construction';
        applyOverrides(overrides, preset);
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
      applyOverrides(nextOverrides, 'custom');
      if (state.currentCompanyId) debounceSave(state.currentCompanyId, nextOverrides, 'custom');
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
      applyOverrides(nextOverrides, 'custom');
      if (state.currentCompanyId) debounceSave(state.currentCompanyId, nextOverrides, 'custom');
    },

    resetAll() {
      const { currentCompanyId } = get();
      applyOverrides({}, 'construction');
      if (currentCompanyId) {
        savePenTableOverrides(currentCompanyId, {}, 'construction').catch(() => {});
      }
    },

    applyPreset(name) {
      const overrides = penSetToOverrides(name);
      applyOverrides(overrides, name);
      const { currentCompanyId } = get();
      if (currentCompanyId) {
        savePenTableOverrides(currentCompanyId, overrides, name).catch(() => {});
      }
    },
  };
});
