'use client';

/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-929 Φ5 — η **επικάλυψη της αναγνώρισης** πάνω στην εικόνα του υποβάθρου: κάθε τμήμα που βρήκε η Φ2, με το
 * επίπεδο βεβαιότητας της σύντηξης (Φ4) σε χρώμα **και** μοτίβο γραμμής (`PLAN_CONFIDENCE_MARKS`, CHECK 3.41).
 * Ζωγραφίζεται ΚΑΤΩ από την προεπισκόπηση τοίχων του ADR-911: ο άνθρωπος βλέπει τι βρέθηκε και, από πάνω, τι θα
 * χτιστεί από αυτό.
 *
 * ADR-040: standalone leaf. ΕΝΑ υψίσυχνο hook (transform) + δύο ΧΑΜΗΛΟΣΥΧΝΑ (store αναγνώρισης · το υπόβαθρο του
 * ορόφου, για την τρέχουσα τοποθέτηση). Η γεωμετρία σκηνής υπολογίζεται μία φορά ανά αποτέλεσμα/τοποθέτηση
 * (`useMemo`)· ανά transform γίνεται μόνο η προβολή. Χωρίς αποτέλεσμα ⇒ `null` πριν από κάθε προβολή.
 * Read-only, pointer-events-none. Ένα `<path>` ανά επίπεδο, όχι ένα ανά τμήμα.
 */

import React from 'react';
import { usePlanRecognitionState } from '../../systems/plan-recognition/plan-recognition-store';
import { PLAN_CONFIDENCE_ORDER, planConfidenceMark } from '../../systems/plan-recognition/plan-confidence';
import { sceneSegmentsByTier, type SceneSegment } from '../../systems/plan-recognition/plan-overlay-geometry';
import { useFloorplanBackgroundStore } from '../../floorplan-background/stores/floorplanBackgroundStore';
// ADR-040 Phase XXII.B — δικό του transform subscription (leaf), όχι prop από τον shell.
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import { worldRingToSvgPath } from './preview-zone/world-ring-path';

interface Props {
  readonly viewport: Viewport;
}

/** Όλα τα τμήματα ενός επιπέδου σε ΕΝΑ path οθόνης (`M a L b` ανά τμήμα). */
function segmentsPath(segments: readonly SceneSegment[], transform: ViewTransform, viewport: Viewport): string {
  return segments.map((s) => worldRingToSvgPath(s, transform, viewport, false)).join(' ');
}

export function PlanRecognitionOverlay({ viewport }: Props): React.ReactElement | null {
  const { run, fusion } = usePlanRecognitionState();
  const floorId = run?.floorId ?? null;
  const background = useFloorplanBackgroundStore((s) => (floorId ? s.floors[floorId]?.background ?? null : null));
  // ADR-040 Phase XXII.B — leaf-level transform (κοστίζει μόνο όσο υπάρχει αποτέλεσμα).
  const transform = useTransformValue();

  const byTier = React.useMemo(
    () => (run && fusion && background
      ? sceneSegmentsByTier(run.segments, fusion.segmentConfidence, background)
      : null),
    [run, fusion, background],
  );

  if (!byTier) return null;

  return (
    <svg
      className="absolute inset-0 size-full pointer-events-none z-10"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="plan-recognition-overlay"
    >
      {PLAN_CONFIDENCE_ORDER.map((tier) => {
        const mark = planConfidenceMark(tier);
        const d = segmentsPath(byTier[tier], transform, viewport);
        return d ? (
          <path
            key={tier}
            d={d}
            fill="none"
            stroke={mark.stroke}
            strokeWidth={mark.strokeWidth}
            strokeDasharray={mark.dash || undefined}
            strokeLinecap="round"
            data-tier={tier}
            data-count={byTier[tier].length}
          />
        ) : null;
      })}
    </svg>
  );
}
