'use client';

/**
 * ADR-340 / ADR-929 Φ5.2 — η βαθμονόμηση του υποβάθρου από την πλευρά του React.
 *
 * Λεπτό στρώμα: τα μαθηματικά ζουν στο καθαρό `geometry/calibration-solve.ts`, η μετατροπή «ό,τι
 * έδωσε ο άνθρωπος → αναφορές» στο `geometry/calibration-draft.ts`. Εδώ μένει μόνο ποια συνεδρία, ποιο
 * υπόβαθρο και η απομνημόνευση.
 *
 * 🔴 Πριν τη Φ5.2 εδώ ζούσε `scaleFactor = realDistMm / dWorld` με κρυφή υπόθεση «σκηνή σε mm» και
 * σημεία σε pixel οθόνης (ADR-929 §6.1 #1) — σε σκηνή σε μέτρα η εικόνα έβγαινε 1000× μεγάλη.
 */

import { useMemo } from 'react';
import { useFloorplanBackgroundStore, type CalibrationPointTarget } from '../stores/floorplanBackgroundStore';
import type { SceneUnits } from '../../utils/scene-units';
import { solveCalibration, type CalibrationSolution, type CalibrationSolveFailure } from '../geometry/calibration-solve';
import {
  toCalibrationReferences,
  toSolverReferences,
  type CalibrationDraftReference,
  type CalibrationLengthDraft,
} from '../geometry/calibration-draft';

// ── Panel-side: start / cancel / progress ─────────────────────────────────────

export interface UseCalibrationResult {
  isActive: boolean;
  /** Πόσα σημεία έχουν δοθεί στο τρέχον βήμα (0..target). */
  pickedCount: number;
  target: CalibrationPointTarget;
  startCalibration: () => void;
  cancelCalibration: () => void;
}

export function useCalibration(floorId: string): UseCalibrationResult {
  const session = useFloorplanBackgroundStore((s) => s.calibrationSession);
  const isActive = session?.floorId === floorId && floorId !== '';
  return {
    isActive,
    pickedCount: isActive ? (session?.points.length ?? 0) : 0,
    target: isActive ? (session?.target ?? 2) : 2,
    startCalibration: () => useFloorplanBackgroundStore.getState().startCalibration(floorId),
    cancelCalibration: () => useFloorplanBackgroundStore.getState().cancelCalibration(),
  };
}

// ── Dialog-side: live preview of the solution ─────────────────────────────────

export type CalibrationPreview =
  | { readonly status: 'incomplete' }
  | { readonly status: 'failed'; readonly reason: CalibrationSolveFailure }
  | {
      readonly status: 'solved';
      readonly solution: CalibrationSolution;
      readonly references: readonly CalibrationDraftReference[];
    };

const INCOMPLETE: CalibrationPreview = { status: 'incomplete' };

/**
 * Η λύση για ό,τι έχει δοθεί **τώρα** — η ίδια που θα γραφτεί με «Εφαρμογή» (καμία δεύτερη πράξη).
 * `incomplete` όσο λείπει μήκος ή σημείο.
 */
export function useCalibrationPreview(
  lengths: readonly CalibrationLengthDraft[],
  alignToAxis: boolean,
  sceneUnits: SceneUnits,
): CalibrationPreview {
  const session = useFloorplanBackgroundStore((s) => s.calibrationSession);
  const background = useFloorplanBackgroundStore(
    (s) => (session ? (s.floors[session.floorId]?.background ?? null) : null),
  );
  return useMemo<CalibrationPreview>(() => {
    if (!session || !background) return INCOMPLETE;
    const refs = toCalibrationReferences(session.points, lengths, background);
    const solverRefs = refs ? toSolverReferences(refs) : null;
    if (!refs || !solverRefs) return INCOMPLETE;
    const result = solveCalibration({ placement: background, references: solverRefs, sceneUnits, alignToAxis });
    return result.ok
      ? { status: 'solved', solution: result.solution, references: refs }
      : { status: 'failed', reason: result.reason };
  }, [session, background, lengths, alignToAxis, sceneUnits]);
}
