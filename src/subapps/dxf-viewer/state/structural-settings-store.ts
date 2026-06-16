'use client';

/**
 * ADR-456 Slice 2b — Structural Settings Store (Zustand, building-persisted).
 *
 * SSoT για τον ενεργό δομοστατικό κανονισμό + προεπιλ. κατηγορία σκυροδέματος.
 * Building-scoped (Revit: ένα κτίριο = ένας κανονισμός) — persist στο
 * `buildings/{buildingId}.structuralSettings` (500 ms debounce). Όταν δεν
 * υπάρχει ενεργό buildingId (standalone DXF), η ρύθμιση ζει μόνο in-memory για
 * τη συνεδρία (δεν persist-άρεται) — graceful degradation.
 *
 * Non-React consumers (validator chain, bridge auto-suggest): χρησιμοποιούν
 * `useStructuralSettingsStore.getState()`. React consumers (ribbon combobox):
 * `useStructuralSettingsStore((s) => s.codeId)`.
 *
 * Building sync: `loadForBuilding(buildingId, settings)` καλείται όταν αλλάζει
 * το ενεργό κτίριο (βλ. `useStructuralSettingsSync`).
 *
 * @see ../bim/structural/structural-settings.ts
 */

import { create } from 'zustand';
import {
  DEFAULT_STRUCTURAL_SETTINGS,
  resolveStructuralSettings,
  type StructuralSettings,
} from '../bim/structural/structural-settings';
import type { StructuralCodeId } from '../bim/structural/codes';
import type { ConcreteGrade } from '../bim/structural/concrete-grades';
import { saveStructuralSettings } from '../services/structural-settings.service';

// ── Debounce helper (per building) ──────────────────────────────────────────

type Timer = ReturnType<typeof setTimeout>;
const pendingTimers: Map<string, Timer> = new Map();

function debounceWrite(buildingId: string, settings: StructuralSettings, delayMs = 500): void {
  const existing = pendingTimers.get(buildingId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    pendingTimers.delete(buildingId);
    saveStructuralSettings(buildingId, settings).catch(() => {
      // fire-and-forget: transient failures are non-critical (heal next edit)
    });
  }, delayMs);
  pendingTimers.set(buildingId, t);
}

// ── Store ────────────────────────────────────────────────────────────────────

export interface StructuralSettingsState extends StructuralSettings {
  /** Ενεργό building doc id· null = standalone (in-memory only, no persist). */
  readonly currentBuildingId: string | null;
  /**
   * Timestamp τελευταίου local setter — ο sync αγνοεί server echoes εντός ενός
   * quiet window ώστε να μη χάνεται pending debounced write (mirror του
   * `bim-render-settings-store`, ADR-375 v2.11).
   */
  readonly lastLocalMutationAt: number;
  /** Φόρτωσε τις ρυθμίσεις του ενεργού κτιρίου (building switch / server push). */
  loadForBuilding(
    buildingId: string | null,
    settings: Partial<StructuralSettings> | null | undefined,
  ): void;
  /** Όρισε τον ενεργό κανονισμό (persist αν υπάρχει building). */
  setCodeId(codeId: StructuralCodeId): void;
  /** Όρισε την προεπιλεγμένη κατηγορία σκυροδέματος (persist αν υπάρχει building). */
  setDefaultConcreteGrade(grade: ConcreteGrade): void;
  /**
   * ADR-464 — Όρισε την επιτρεπόμενη τάση έδρασης εδάφους σ_allow (kPa). `undefined`/
   * μη-θετικό → καθαρίζει τη ρύθμιση (advisory off). Persist αν υπάρχει building.
   */
  setSoilBearingCapacityKpa(kpa: number | undefined): void;
}

export const useStructuralSettingsStore = create<StructuralSettingsState>((set, get) => {
  function raw(state: StructuralSettingsState): StructuralSettings {
    const base: StructuralSettings = {
      codeId: state.codeId,
      defaultConcreteGrade: state.defaultConcreteGrade,
    };
    // ADR-464 — μετέφερε το σ_allow αυτούσιο (omit-when-absent → Firestore-safe).
    return state.soilBearingCapacityKpa !== undefined && state.soilBearingCapacityKpa > 0
      ? { ...base, soilBearingCapacityKpa: state.soilBearingCapacityKpa }
      : base;
  }

  return {
    ...DEFAULT_STRUCTURAL_SETTINGS,
    currentBuildingId: null,
    lastLocalMutationAt: 0,

    loadForBuilding(buildingId, settings) {
      const resolved = resolveStructuralSettings(settings);
      set({
        currentBuildingId: buildingId,
        codeId: resolved.codeId,
        defaultConcreteGrade: resolved.defaultConcreteGrade,
        // ADR-464 — σ_allow building setting (absent → undefined, in-memory only).
        soilBearingCapacityKpa: resolved.soilBearingCapacityKpa,
        lastLocalMutationAt: 0,
      });
    },

    setCodeId(codeId) {
      if (get().codeId === codeId) return; // idempotent — no-op write
      set({ codeId, lastLocalMutationAt: Date.now() });
      const { currentBuildingId } = get();
      if (currentBuildingId) debounceWrite(currentBuildingId, raw(get()));
    },

    setDefaultConcreteGrade(grade) {
      if (get().defaultConcreteGrade === grade) return; // idempotent — no-op write
      set({ defaultConcreteGrade: grade, lastLocalMutationAt: Date.now() });
      const { currentBuildingId } = get();
      if (currentBuildingId) debounceWrite(currentBuildingId, raw(get()));
    },

    setSoilBearingCapacityKpa(kpa) {
      // Normalize: μη-θετικό/μη-πεπερασμένο → undefined (clear).
      const next = typeof kpa === 'number' && Number.isFinite(kpa) && kpa > 0 ? kpa : undefined;
      if (get().soilBearingCapacityKpa === next) return; // idempotent — no-op write
      set({ soilBearingCapacityKpa: next, lastLocalMutationAt: Date.now() });
      const { currentBuildingId } = get();
      if (currentBuildingId) debounceWrite(currentBuildingId, raw(get()));
    },
  };
});
