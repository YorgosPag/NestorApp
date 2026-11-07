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
 * ADR-929 Φ5.4β — τα τμήματα που η πολιτική ρόλων βγάζει **εκτός τοίχων** (διαστάσεις, γραμμές επέκτασης, πινελιές
 * κειμένου) ζωγραφίζονται **μόνο** με το σημάδι του ρόλου τους (`PLAN_SEGMENT_ROLE_MARKS`), όχι με επίπεδο βεβαιότητας:
 * η βεβαιότητα αφορά τους τοίχους. Κάθε τμήμα ζωγραφίζεται ακριβώς μία φορά.
 *
 * ADR-040: standalone leaf. ΕΝΑ υψίσυχνο hook (transform) + δύο ΧΑΜΗΛΟΣΥΧΝΑ (store αναγνώρισης · το υπόβαθρο του
 * ορόφου, για την τρέχουσα τοποθέτηση). Η γεωμετρία σκηνής υπολογίζεται μία φορά ανά αποτέλεσμα/τοποθέτηση
 * (`useMemo`)· ανά transform γίνεται μόνο η προβολή. Χωρίς αποτέλεσμα ⇒ `null` πριν από κάθε προβολή.
 * Read-only, pointer-events-none. Ένα `<path>` ανά επίπεδο ή σημάδι ρόλου, όχι ένα ανά τμήμα.
 */

import React from 'react';
import { usePlanRecognitionState } from '../../systems/plan-recognition/plan-recognition-store';
import {
  PLAN_CONFIDENCE_ORDER,
  planConfidenceMark,
  type PlanConfidenceMark,
} from '../../systems/plan-recognition/plan-confidence';
import { PLAN_ROLE_MARK_ORDER, planRoleMark } from '../../systems/plan-recognition/plan-role-marks';
import { scenePlanSegments, type SceneSegment } from '../../systems/plan-recognition/plan-overlay-geometry';
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

/** Ένα `<path>` για όλα τα τμήματα ενός σημαδιού· τίποτα όταν δεν υπάρχει τμήμα. */
function MarkPath({ d, mark, count, dataAttr }: {
  readonly d: string;
  readonly mark: PlanConfidenceMark;
  readonly count: number;
  readonly dataAttr: { readonly 'data-tier': string } | { readonly 'data-role': string };
}): React.ReactElement | null {
  if (!d) return null;
  return (
    <path
      d={d}
      fill="none"
      stroke={mark.stroke}
      strokeWidth={mark.strokeWidth}
      strokeDasharray={mark.dash || undefined}
      strokeLinecap="round"
      data-count={count}
      {...dataAttr}
    />
  );
}

export function PlanRecognitionOverlay({ viewport }: Props): React.ReactElement | null {
  const { run, fusion } = usePlanRecognitionState();
  const floorId = run?.floorId ?? null;
  const background = useFloorplanBackgroundStore((s) => (floorId ? s.floors[floorId]?.background ?? null : null));
  // ADR-040 Phase XXII.B — leaf-level transform (κοστίζει μόνο όσο υπάρχει αποτέλεσμα).
  const transform = useTransformValue();

  const overlay = React.useMemo(
    () => (run && fusion && background
      ? scenePlanSegments(run.segments, fusion.segmentConfidence, fusion.segmentRoles, background)
      : null),
    [run, fusion, background],
  );

  if (!overlay) return null;
  const { byTier, byRole } = overlay;

  return (
    <svg
      className="absolute inset-0 size-full pointer-events-none z-10"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="plan-recognition-overlay"
    >
      {PLAN_CONFIDENCE_ORDER.map((tier) => (
        <MarkPath
          key={tier}
          d={segmentsPath(byTier[tier], transform, viewport)}
          mark={planConfidenceMark(tier)}
          count={byTier[tier].length}
          dataAttr={{ 'data-tier': tier }}
        />
      ))}
      {PLAN_ROLE_MARK_ORDER.map((role) => (
        <MarkPath
          key={role}
          d={segmentsPath(byRole[role], transform, viewport)}
          mark={planRoleMark(role)}
          count={byRole[role].length}
          dataAttr={{ 'data-role': role }}
        />
      ))}
    </svg>
  );
}
