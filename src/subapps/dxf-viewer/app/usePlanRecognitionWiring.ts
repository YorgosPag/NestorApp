'use client';

/**
 * ADR-929 Φ5 — δένει την **αναγνώριση κάτοψης** με τον βοηθό «Μοντέλο από το σχέδιο» (ADR-911).
 *
 *   «Αναγνώριση από την εικόνα» → `planRecognitionSession.run(ενεργός όροφος)` → πηγή γραμμών →
 *   `modelFromDrawingSession.adoptRasterSegments` (η ΙΔΙΑ μηχανή, προεπισκόπηση, ομάδες πάχους, έγκριση).
 *
 * Υπολογίζει και την όψη του πάνελ (`ImageSourceView`) από δύο χαμηλόσυχνα stores (αναγνώριση · υπόβαθρο). Το
 * κλείσιμο του βοηθού ή «άλλο δείγμα» κλείνει και την αναγνώριση (και τον Worker της).
 *
 * @see ./ModelFromDrawingHost.tsx
 */

import * as React from 'react';
import { usePlanRecognitionState } from '../systems/plan-recognition/plan-recognition-store';
import { isWallEvidence, planRecognitionSession } from '../systems/plan-recognition/plan-recognition-session';
import { countByConfidenceTier } from '../systems/plan-recognition/plan-confidence';
import {
  modelFromDrawingSession,
  type ModelFromDrawingDeps,
} from '../systems/model-from-drawing/model-from-drawing-session';
import type { ModelFromDrawingState } from '../systems/model-from-drawing/model-from-drawing-store';
import { getActiveBackgroundFloorId, useFloorplanBackgroundStore } from '../floorplan-background/stores/floorplanBackgroundStore';
import type { ImageSourceView } from '../ui/panels/model-from-drawing/PlanRecognitionSections';

export interface PlanRecognitionWiring {
  readonly imageSource: ImageSourceView;
  readonly recognizeImage: () => void;
}

/** Η όψη του πάνελ για την πηγή εικόνα. */
function useImageSourceView(state: ModelFromDrawingState): ImageSourceView {
  const recognition = usePlanRecognitionState();
  const activeBackground = useFloorplanBackgroundStore((s) =>
    (s.activeFloorId ? s.floors[s.activeFloorId]?.background ?? null : null));
  const sourceFloorId = state.lineSource.kind === 'raster' ? state.lineSource.floorId : null;
  const sourceCalibrated = useFloorplanBackgroundStore((s) =>
    (sourceFloorId ? (s.floors[sourceFloorId]?.background?.calibration ?? null) !== null : false));
  const { counts, excludedFromWalls } = React.useMemo(() => {
    const { run, fusion } = recognition;
    if (!run || !fusion) return { counts: null, excludedFromWalls: 0 };
    return {
      counts: countByConfidenceTier(run.segments.map((s) => fusion.segmentConfidence.get(s.id)?.score ?? null)),
      excludedFromWalls: run.segments.filter((s) => !isWallEvidence(fusion, s.id)).length,
    };
  }, [recognition]);
  return {
    available: activeBackground !== null,
    phase: recognition.phase,
    failure: recognition.failure,
    active: state.lineSource.kind === 'raster',
    countsByTier: counts,
    excludedFromWalls,
    calibrated: sourceCalibrated,
  };
}

export function usePlanRecognitionWiring(
  state: ModelFromDrawingState,
  getDeps: () => ModelFromDrawingDeps,
): PlanRecognitionWiring {
  const imageSource = useImageSourceView(state);

  const recognizeImage = React.useCallback((): void => {
    const floorId = getActiveBackgroundFloorId();
    if (!floorId) return;
    void planRecognitionSession.run(floorId).then((source) => {
      if (source) modelFromDrawingSession.adoptRasterSegments(source, getDeps());
    });
  }, [getDeps]);

  // Δίχτυ: ο βοηθός έκλεισε (από οπουδήποτε, π.χ. Esc) ⇒ καμία αναγνώριση πάνω στον καμβά, κανένας Worker ζωντανός.
  // Το «άλλο δείγμα» την κλείνει ρητά ο host (`planRecognitionSession.close` πριν το `open`).
  const closed = state.phase === 'closed';
  React.useEffect(() => {
    if (closed) planRecognitionSession.close();
  }, [closed]);
  React.useEffect(() => () => planRecognitionSession.close(), []);

  return { imageSource, recognizeImage };
}
