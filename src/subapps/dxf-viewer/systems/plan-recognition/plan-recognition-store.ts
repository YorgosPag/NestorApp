/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-929 Φ5 — store της **αναγνώρισης κάτοψης** που ελέγχει ο άνθρωπος (ΧΑΜΗΛΟΣΥΧΝΟ).
 *
 * Κρατά το αποτέλεσμα των Φ1/Φ2 (ευθυγράμμιση + τμήματα), την ανάγνωση της Φ3 (όταν ζητηθεί) και τη σύντηξη της
 * Φ4. Τίποτα εδώ δεν είναι η σκηνή: οι τοίχοι γράφονται μόνο από τον ελεγκτή του ADR-911 μετά από ρητή έγκριση.
 * Γράφεται σε διακριτές πράξεις (έναρξη · τέλος ευθυγράμμισης · απάντηση · ανάγνωση) — ποτέ ανά καρέ.
 *
 * ⚠️ ΕΝΑΣ γραφέας: `plan-recognition-session.ts`.
 *
 * @see ./plan-recognition-session.ts
 * @see ../../components/dxf-layout/PlanRecognitionOverlay.tsx (καταναλωτής καμβά)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../stores/createExternalStore';
import type { PlanAlignment } from '../../bim/plan-recognition/alignment/plan-alignment-types';
import type { PlanFusionResult } from '../../bim/plan-recognition/fusion/plan-fusion-types';
import type {
  PlanInputKind,
  PlanReadingOutcome,
  RasterSegment,
} from '../../bim/plan-recognition/plan-recognition-types';
import type { RasterPixelScale } from '../../floorplan-background/geometry/raster-pixel-scale';

/** `idle` — καμία αναγνώριση · `running` — ευθυγράμμιση/τμήματα σε εξέλιξη · `ready` — υπάρχει αποτέλεσμα. */
export type PlanRecognitionPhase = 'idle' | 'running' | 'ready';

/** Γιατί δεν βγήκε αποτέλεσμα — ΠΑΝΤΑ με όνομα (Δ16 #4). */
export type PlanRecognitionFailure = 'no-background' | 'no-pixels' | 'aligner-failed' | 'no-segments';

/** Ό,τι έδωσαν οι Φ1/Φ2 για ΕΝΑ υπόβαθρο: η είσοδος κάθε επανάληψης της σύντηξης. */
export interface PlanRecognitionRun {
  readonly id: string;
  readonly floorId: string;
  readonly backgroundId: string;
  readonly kind: PlanInputKind;
  readonly alignment: PlanAlignment;
  readonly segments: readonly RasterSegment[];
  /** Η κλίμακα του υποβάθρου τη στιγμή της αναγνώρισης (`resolveRasterPixelScale`, Δ4). */
  readonly knownScale: RasterPixelScale | null;
}

export interface PlanRecognitionState {
  readonly phase: PlanRecognitionPhase;
  readonly run: PlanRecognitionRun | null;
  /** `null` = δεν ζητήθηκε ανάγνωση (η γεωμετρία μόνη της, Δ15 #1). */
  readonly reading: PlanReadingOutcome | null;
  readonly fusion: PlanFusionResult | null;
  readonly failure: PlanRecognitionFailure | null;
}

const IDLE: PlanRecognitionState = { phase: 'idle', run: null, reading: null, fusion: null, failure: null };

const store = createExternalStore<PlanRecognitionState>(IDLE, { equals: Object.is });

export const planRecognitionStore = {
  get(): PlanRecognitionState {
    return store.get();
  },
  /** Μερική ενημέρωση — ΜΟΝΟ από τον ελεγκτή. */
  patch(next: Partial<PlanRecognitionState>): void {
    store.set({ ...store.get(), ...next });
  },
  reset(): void {
    store.set(IDLE);
  },
  subscribe(listener: () => void): () => void {
    return store.subscribe(listener);
  },
};

/** React συνδρομή (φύλλο καμβά · πάνελ). */
export function usePlanRecognitionState(): PlanRecognitionState {
  return useSyncExternalStore(store.subscribe, store.get, () => IDLE);
}
