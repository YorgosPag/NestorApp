'use client';

/**
 * ADR-929 Φ5 — δένει την **αναγνώριση κάτοψης** με τον βοηθό «Μοντέλο από το σχέδιο» (ADR-911).
 *
 *   «Αναγνώριση από την εικόνα» → `planRecognitionSession.run(ενεργός όροφος)` → πηγή γραμμών →
 *   `modelFromDrawingSession.adoptRasterSegments` (η ΙΔΙΑ μηχανή, προεπισκόπηση, ομάδες πάχους, έγκριση).
 *
 * Υπολογίζει και την όψη του πάνελ (`ImageSourceView`) από δύο χαμηλόσυχνα stores (αναγνώριση · υπόβαθρο). Το
 * κλείσιμο του βοηθού ή «άλλο δείγμα» κλείνει και την αναγνώριση (και τους Workers της). Η τοπική ανάγνωση (Φ0.6) ξεκινά
 * μόνη της· όταν τελειώσει, η νέα πηγή γραμμών έρχεται από το ίδιο κανάλι με την επανεξαγωγή (`onLineSource`).
 *
 * @see ./ModelFromDrawingHost.tsx
 */

import * as React from 'react';
import { usePlanRecognitionState, type PlanRecognitionState } from '../systems/plan-recognition/plan-recognition-store';
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
import type { PlanOcrActions, PlanOcrView } from '../ui/panels/model-from-drawing/PlanOcrSection';
import type { PlanReadValuesActions } from '../ui/panels/model-from-drawing/PlanReadValuesSection';
import { isLocalOcrOutcome } from '../bim/plan-recognition/ocr/ocr-reading';
import { applyReadingCorrectionsToOutcome } from '../bim/plan-recognition/reading/reading-corrections';
import type { PlanReadingOutcome } from '../bim/plan-recognition/plan-recognition-types';
import { planReadValueRows, type PlanReadValueRow } from '../systems/plan-recognition/plan-read-values';
import { usePlanScaleWiring } from './usePlanScaleWiring';

export interface PlanRecognitionWiring {
  readonly imageSource: ImageSourceView;
  readonly recognizeImage: () => void;
  /** ADR-929 Φ5.3β — η ανάγνωση κειμένων: η όψη, ο έλεγχος, η αποστολή. */
  readonly reading: PlanReadingActions;
  /** ADR-929 Φ5.3γ — η κάρτα κλίμακας από τις διαβασμένες διαστάσεις. */
  readonly scale: PlanScaleActions;
  /** ADR-929 Φ0.6 — η τοπική ανάγνωση τιμών: «Ακύρωση» · «Ξανά». */
  readonly ocr: PlanOcrActions;
  /** ADR-929 Δ21 (δ) — «Τι διάβασα»: διόρθωση · «δεν είναι διάσταση» · επαναφορά · επισήμανση. */
  readonly readValues: PlanReadValuesActions;
}

/** Σταθερή ταυτότητα σε κάθε render: οι πράξεις πάνε κατευθείαν στον έναν ελεγκτή. */
const OCR_ACTIONS: PlanOcrActions = {
  onCancel: () => planRecognitionSession.ocr.cancel(),
  onRetry: () => planRecognitionSession.ocr.retry(),
};

/**
 * ADR-929 Δ21 (δ) — οι διορθώσεις πάνε κατευθείαν στον έναν ελεγκτή· η νέα πηγή γραμμών έρχεται από το `onLineSource`,
 * όπως στην επανεξαγωγή. Σταθερή ταυτότητα σε κάθε render.
 */
const READ_VALUES_ACTIONS: PlanReadValuesActions = {
  onCorrect: (textId, raw) => { planRecognitionSession.corrections.correct(textId, raw); },
  onMarkNotDimension: (textId) => { planRecognitionSession.corrections.markNotDimension(textId); },
  onRevert: (textId) => { planRecognitionSession.corrections.revert(textId); },
  onHover: (textId) => planRecognitionSession.corrections.hover(textId),
  previewCorrection: (textId, raw) => planRecognitionSession.corrections.preview(textId, raw),
};

/** ADR-929 Φ0.6 — η όψη της τοπικής ανάγνωσης: μετρά στη σύντηξη; και τι, στην τρέχουσα όψη (με τις διορθώσεις). */
function ocrViewOf(recognition: PlanRecognitionState, reading: PlanReadingOutcome | null): PlanOcrView {
  const { ocr } = recognition;
  const inUse = isLocalOcrOutcome(reading);
  const counts = inUse && reading?.status === 'read'
    ? { texts: reading.reading.texts.length, dimensions: reading.reading.dimensions.length }
    : null;
  return { state: ocr, inUse, counts };
}

/**
 * ADR-929 Δ21 (δ) — η ανάγνωση που ισχύει (της μηχανής + οι διορθώσεις του ανθρώπου, η ίδια που μπήκε στη σύντηξη) και οι
 * γραμμές της λίστας «Τι διάβασα».
 */
function useReadValues(recognition: PlanRecognitionState): {
  readonly effectiveReading: PlanReadingOutcome | null;
  readonly readValues: readonly PlanReadValueRow[] | null;
} {
  const { reading, readingCorrections, fusion } = recognition;
  const effectiveReading = React.useMemo(
    () => applyReadingCorrectionsToOutcome(reading, readingCorrections),
    [reading, readingCorrections],
  );
  const readValues = React.useMemo((): readonly PlanReadValueRow[] | null => (
    effectiveReading?.status === 'read' ? planReadValueRows(effectiveReading.reading, fusion) : null
  ), [effectiveReading, fusion]);
  return { effectiveReading, readValues };
}

/** Η όψη του πάνελ για την πηγή εικόνα. */
function useImageSourceView(state: ModelFromDrawingState, scale: PlanScaleView): ImageSourceView {
  const recognition = usePlanRecognitionState();
  const activeBackground = useFloorplanBackgroundStore((s) =>
    (s.activeFloorId ? s.floors[s.activeFloorId]?.background ?? null : null));
  const sourceFloorId = state.lineSource.kind === 'raster' ? state.lineSource.floorId : null;
  const sourceCalibrated = useFloorplanBackgroundStore((s) =>
    (sourceFloorId ? (s.floors[sourceFloorId]?.background?.calibration ?? null) !== null : false));
  const { effectiveReading, readValues } = useReadValues(recognition);
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
    // §6.10 Α2 — μόνο η ανάγνωση AI ακυρώνεται με αλλαγή της όψης· η τοπική ακολουθεί την όψη (Φ0.6).
    readingAdopted: recognition.reading !== null && !isLocalOcrOutcome(recognition.reading),
    review: recognition.review,
    scale,
    ocr: ocrViewOf(recognition, effectiveReading),
    readValues,
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
      onUndoReadingDrop: () => review.undoReadingDrop(),
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

  // ADR-929 §6.10 Α2 — οι τοίχοι ξαναβγήκαν από νέα όψη (ή αναίρεση): ο βοηθός υιοθετεί τη νέα πηγή (η ΙΔΙΑ μηχανή).
  React.useEffect(
    () => planRecognitionSession.onLineSource((source) => modelFromDrawingSession.adoptRasterSegments(source, getDeps())),
    [getDeps],
  );

  const reading = usePlanReadingActions(getDeps);
  return { imageSource, recognizeImage, reading, scale: scale.actions, ocr: OCR_ACTIONS, readValues: READ_VALUES_ACTIONS };
}
