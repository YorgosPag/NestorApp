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
 * ADR-929 §6.21.9 (Ε2) — η γεωμετρία είναι τα **συνορθωμένα** τμήματα της σύντηξης (`adjustedSegments`, ό,τι θα
 * γραφτεί — η ίδια θέση με την προεπισκόπηση του ADR-911), όχι τα ακατέργαστα της Φ2. Οι γωνίες της σύντηξης
 * (`segmentCorners`) ενώνουν τα τμήματα ενός σημαδιού σε πολυγραμμές: γωνία = `miter`, ανοιχτό άκρο = `butt`.
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
import { scenePlanSegments, type ScenePolyline } from '../../systems/plan-recognition/plan-overlay-geometry';
import { segmentCorners } from '../../bim/plan-recognition/fusion/segment-junctions';
import { useFloorplanBackgroundStore } from '../../floorplan-background/stores/floorplanBackgroundStore';
// ADR-040 Phase XXII.B — δικό του transform subscription (leaf), όχι prop από τον shell.
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import { worldRingToSvgPath } from './preview-zone/world-ring-path';

interface Props {
  readonly viewport: Viewport;
}

/** Όλες οι πολυγραμμές ενός σημαδιού σε ΕΝΑ path οθόνης (μία υποδιαδρομή ανά πολυγραμμή, `Z` στους βρόχους). */
function polylinesPath(polylines: readonly ScenePolyline[], transform: ViewTransform, viewport: Viewport): string {
  return polylines.map((p) => worldRingToSvgPath(p.points, transform, viewport, p.closed)).join(' ');
}

/** Πόσα τμήματα ζωγραφίζει ένα σημάδι (κάθε τμήμα μετριέται μία φορά, όσο κι αν ενώθηκε σε πολυγραμμή). */
const segmentCountOf = (polylines: readonly ScenePolyline[]): number => polylines.reduce((n, p) => n + p.segmentCount, 0);

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
      strokeLinecap="butt"
      strokeLinejoin="miter"
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
      // §6.21.9 — τα ΣΥΝΟΡΘΩΜΕΝΑ τμήματα (ό,τι θα γραφτεί), με τις γωνίες της ΙΔΙΑΣ σύντηξης.
      ? scenePlanSegments(
        fusion.adjustedSegments, fusion.segmentConfidence, fusion.segmentRoles, segmentCorners(fusion.segmentJunctions), background,
      )
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
          d={polylinesPath(byTier[tier], transform, viewport)}
          mark={planConfidenceMark(tier)}
          count={segmentCountOf(byTier[tier])}
          dataAttr={{ 'data-tier': tier }}
        />
      ))}
      {PLAN_ROLE_MARK_ORDER.map((role) => (
        <MarkPath
          key={role}
          d={polylinesPath(byRole[role], transform, viewport)}
          mark={planRoleMark(role)}
          count={segmentCountOf(byRole[role])}
          dataAttr={{ 'data-role': role }}
        />
      ))}
    </svg>
  );
}
