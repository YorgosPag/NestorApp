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
import type { OccupancyCategory } from '../bim/structural/loads/occupancy-loads';

// ── Debounce helper (per building) ──────────────────────────────────────────

type Timer = ReturnType<typeof setTimeout>;
const pendingTimers: Map<string, Timer> = new Map();

/**
 * Persist debounced (500 ms). Το `structural-settings.service` (Firestore/Firebase
 * stack) φορτώνεται **lazy** μέσα στο `setTimeout` ώστε αυτό το store module να μένει
 * pure στο import-graph (zero Firebase at module-init). Έτσι κάθε καθαρός consumer
 * (renderers / converters / validators / section-context) που διαβάζει
 * `getState().codeId` παραμένει testable χωρίς `fetch`/Firebase landmine. Το save ήταν
 * ήδη deferred + fire-and-forget → μηδέν behavior change. Pattern ήδη καθιερωμένο
 * (12+ αρχεία με `await import()` για heavy persistence deps).
 */
function debounceWrite(buildingId: string, settings: StructuralSettings, delayMs = 500): void {
  const existing = pendingTimers.get(buildingId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    pendingTimers.delete(buildingId);
    void import('../services/structural-settings.service')
      .then((m) => m.saveStructuralSettings(buildingId, settings))
      .catch(() => {
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
  /**
   * ADR-464 Slice 4 — Όρισε το μόνιμο κατανεμημένο φορτίο ορόφου G (kPa). `undefined`/
   * μη-θετικό → καθαρίζει (takedown advisory off). Persist αν υπάρχει building.
   */
  setDeadAreaLoadKpa(kpa: number | undefined): void;
  /** ADR-464 Slice 4 — Όρισε το μεταβλητό κατανεμημένο φορτίο ορόφου Q (kPa). */
  setLiveAreaLoadKpa(kpa: number | undefined): void;
  /**
   * ADR-474 — Όρισε την κατηγορία χρήσης κτιρίου (auto area loads όταν λείπουν ρητά
   * kPa). Persist αν υπάρχει building. `undefined` → καθαρίζει (πέφτει σε default).
   */
  setOccupancy(occupancy: OccupancyCategory | undefined): void;
}

export const useStructuralSettingsStore = create<StructuralSettingsState>((set, get) => {
  function raw(state: StructuralSettingsState): StructuralSettings {
    let base: StructuralSettings = {
      codeId: state.codeId,
      defaultConcreteGrade: state.defaultConcreteGrade,
    };
    // ADR-464 — μετέφερε σ_allow + area loads αυτούσια (omit-when-absent → Firestore-safe).
    if (state.soilBearingCapacityKpa !== undefined && state.soilBearingCapacityKpa > 0) {
      base = { ...base, soilBearingCapacityKpa: state.soilBearingCapacityKpa };
    }
    if (state.deadAreaLoadKpa !== undefined && state.deadAreaLoadKpa > 0) {
      base = { ...base, deadAreaLoadKpa: state.deadAreaLoadKpa };
    }
    if (state.liveAreaLoadKpa !== undefined && state.liveAreaLoadKpa > 0) {
      base = { ...base, liveAreaLoadKpa: state.liveAreaLoadKpa };
    }
    // ADR-474 — κατηγορία χρήσης (omit-when-absent → Firestore-safe· default σιωπηρό).
    if (state.occupancy !== undefined) {
      base = { ...base, occupancy: state.occupancy };
    }
    return base;
  }

  /** Normalize μια kPa τιμή → θετική πεπερασμένη ή undefined (clear). */
  function normKpa(kpa: number | undefined): number | undefined {
    return typeof kpa === 'number' && Number.isFinite(kpa) && kpa > 0 ? kpa : undefined;
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
        // ADR-464 — σ_allow + area loads building settings (absent → undefined).
        soilBearingCapacityKpa: resolved.soilBearingCapacityKpa,
        deadAreaLoadKpa: resolved.deadAreaLoadKpa,
        liveAreaLoadKpa: resolved.liveAreaLoadKpa,
        occupancy: resolved.occupancy,
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
      const next = normKpa(kpa);
      if (get().soilBearingCapacityKpa === next) return; // idempotent — no-op write
      set({ soilBearingCapacityKpa: next, lastLocalMutationAt: Date.now() });
      const { currentBuildingId } = get();
      if (currentBuildingId) debounceWrite(currentBuildingId, raw(get()));
    },

    setDeadAreaLoadKpa(kpa) {
      const next = normKpa(kpa);
      if (get().deadAreaLoadKpa === next) return; // idempotent — no-op write
      set({ deadAreaLoadKpa: next, lastLocalMutationAt: Date.now() });
      const { currentBuildingId } = get();
      if (currentBuildingId) debounceWrite(currentBuildingId, raw(get()));
    },

    setLiveAreaLoadKpa(kpa) {
      const next = normKpa(kpa);
      if (get().liveAreaLoadKpa === next) return; // idempotent — no-op write
      set({ liveAreaLoadKpa: next, lastLocalMutationAt: Date.now() });
      const { currentBuildingId } = get();
      if (currentBuildingId) debounceWrite(currentBuildingId, raw(get()));
    },

    setOccupancy(occupancy) {
      if (get().occupancy === occupancy) return; // idempotent — no-op write
      set({ occupancy, lastLocalMutationAt: Date.now() });
      const { currentBuildingId } = get();
      if (currentBuildingId) debounceWrite(currentBuildingId, raw(get()));
    },
  };
});
