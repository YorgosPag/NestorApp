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
import {
  NO_WALL_EVIDENCE_EXCLUSIONS,
  planRecognitionSession,
  wallEvidenceExclusions,
} from '../systems/plan-recognition/plan-recognition-session';
import { countByConfidenceTier } from '../systems/plan-recognition/plan-confidence';
import { planRoleMarkKind } from '../systems/plan-recognition/plan-role-marks';
import {
  modelFromDrawingSession,
  type ModelFromDrawingDeps,
} from '../systems/model-from-drawing/model-from-drawing-session';
import type { ModelFromDrawingState } from '../systems/model-from-drawing/model-from-drawing-store';
import { getActiveBackgroundFloorId, useFloorplanBackgroundStore } from '../floorplan-background/stores/floorplanBackgroundStore';
import type { ImageSourceView } from '../ui/panels/model-from-drawing/PlanRecognitionSections';
import type { PlanReadingActions } from '../ui/panels/model-from-drawing/PlanReadingSections';
import type { PlanScaleActions, PlanScaleView } from '../ui/panels/model-from-drawing/PlanScaleCard';
import { usePlanScaleWiring } from './usePlanScaleWiring';

export interface PlanRecognitionWiring {
  readonly imageSource: ImageSourceView;
  readonly recognizeImage: () => void;
  /** ADR-929 Φ5.3β — η ανάγνωση κειμένων: η όψη, ο έλεγχος, η αποστολή. */
  readonly reading: PlanReadingActions;
  /** ADR-929 Φ5.3γ — η κάρτα κλίμακας από τις διαβασμένες διαστάσεις. */
  readonly scale: PlanScaleActions;
}

/** Η όψη του πάνελ για την πηγή εικόνα. */
function useImageSourceView(state: ModelFromDrawingState, scale: PlanScaleView): ImageSourceView {
  const recognition = usePlanRecognitionState();
  const activeBackground = useFloorplanBackgroundStore((s) =>
    (s.activeFloorId ? s.floors[s.activeFloorId]?.background ?? null : null));
  const sourceFloorId = state.lineSource.kind === 'raster' ? state.lineSource.floorId : null;
  const sourceCalibrated = useFloorplanBackgroundStore((s) =>
    (sourceFloorId ? (s.floors[sourceFloorId]?.background?.calibration ?? null) !== null : false));
  const { counts, excludedFromWalls } = React.useMemo(() => {
    const { run, fusion } = recognition;
    if (!run || !fusion) return { counts: null, excludedFromWalls: NO_WALL_EVIDENCE_EXCLUSIONS };
    // Φ5.4β — τα επίπεδα μετρούν ό,τι ζωγραφίζουν: τα τμήματα με σημάδι ρόλου μετρά το υπόμνημα ρόλων.
    const tiered = run.segments.filter((s) => planRoleMarkKind(fusion.segmentRoles.get(s.id)) === null);
    return {
      counts: countByConfidenceTier(tiered.map((s) => fusion.segmentConfidence.get(s.id)?.score ?? null)),
      excludedFromWalls: wallEvidenceExclusions(fusion, run.segments),
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
    readingAvailable: recognition.phase === 'ready' && recognition.run !== null,
    review: recognition.review,
    scale,
  };
}

/**
 * ADR-929 Φ5.3β — οι πράξεις της ανάγνωσης → ο ελεγκτής. Μετά από ανάγνωση που μπήκε στη σύντηξη, ο βοηθός υιοθετεί τη
 * νέα πηγή γραμμών (η ΙΔΙΑ μηχανή). ⚠️ Τα αμφίσημα ορθογώνια που αποφασίστηκαν ξαναρωτιούνται: η σύντηξη με ανάγνωση
 * αλλάζει τη γεωμετρία και τα κλειδιά τους. Οι επιβεβαιωμένες ομάδες πάχους μένουν (ίδιος όροφος).
 */
function usePlanReadingActions(getDeps: () => ModelFromDrawingDeps): PlanReadingActions {
  return React.useMemo((): PlanReadingActions => {
    const review = planRecognitionSession.review;
    return {
      onBegin: () => review.begin(),
      onEnd: () => review.end(),
      onToggleAddRegion: () => review.toggleAddRegion(),
      onReset: () => review.reset(),
      onPrepare: () => { void review.prepare(); },
      onSend: () => {
        void review.send().then((source) => {
          if (source) modelFromDrawingSession.adoptRasterSegments(source, getDeps());
        });
      },
    };
  }, [getDeps]);
}

export function usePlanRecognitionWiring(
  state: ModelFromDrawingState,
  getDeps: () => ModelFromDrawingDeps,
): PlanRecognitionWiring {
  const scale = usePlanScaleWiring(getDeps);
  const imageSource = useImageSourceView(state, scale.view);

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

  const reading = usePlanReadingActions(getDeps);
  return { imageSource, recognizeImage, reading, scale: scale.actions };
}
