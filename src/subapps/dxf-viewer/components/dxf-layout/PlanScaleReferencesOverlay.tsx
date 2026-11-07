'use client';

/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-929 Φ5.3γ — η **οπτική απόδειξη** της κάρτας κλίμακας πάνω στην εικόνα: κάθε διάσταση που ορίζει την κλίμακα ως
 * γραμμή μέτρησης με απολήξεις, ανάμεσα στις δύο παρειές που μετρά, και κάθε διάσταση που έμεινε έξω ως διακεκομμένο
 * πλαίσιο γύρω από το κείμενό της. Η γραμμή της κάρτας που δείχνει ο άνθρωπος τονίζεται (Revit «Resize graphically»:
 * βλέπεις **πού** μετράς, όχι μόνο τον αριθμό).
 *
 * Σημάδια: τα **υπάρχοντα** `PLAN_CONFIDENCE_MARKS` (CHECK 3.41), συμπαγές = ορίζει την κλίμακα, διακεκομμένο = έξω. Η
 * διάκριση γίνεται και με **σχήμα** (γραμμή vs πλαίσιο), όχι μόνο με χρώμα.
 *
 * ADR-040: standalone leaf. ΕΝΑ υψίσυχνο hook (transform) + δύο ΧΑΜΗΛΟΣΥΧΝΑ (store αναγνώρισης · υπόβαθρο του ορόφου).
 * Η γεωμετρία σκηνής υπολογίζεται μία φορά ανά (σύντηξη, τοποθέτηση) (`useMemo`)· ανά transform γίνεται μόνο η προβολή.
 * Χωρίς κάρτα ⇒ `null` πριν από κάθε προβολή. Read-only, pointer-events-none.
 */

import React from 'react';
import { usePlanRecognitionState } from '../../systems/plan-recognition/plan-recognition-store';
import { planRecognitionSession } from '../../systems/plan-recognition/plan-recognition-session';
import { planConfidenceMark } from '../../systems/plan-recognition/plan-confidence';
import { sceneScaleReferences, type SceneScaleReference } from '../../systems/plan-recognition/plan-overlay-geometry';
import { useFloorplanBackgroundStore } from '../../floorplan-background/stores/floorplanBackgroundStore';
// ADR-040 Phase XXII.B — δικό του transform subscription (leaf), όχι prop από τον shell.
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { screenPointsToSvgPath, worldRingToScreen, worldRingToSvgPath } from './preview-zone/world-ring-path';

interface Props {
  readonly viewport: Viewport;
}

/** Μισό μήκος απόληξης γραμμής μέτρησης, σε pixel οθόνης (σταθερό σε κάθε ζουμ, όπως οι λαβές). */
const TICK_HALF_PX = 5;
/** Πόσο παχύτερη γίνεται η γραμμή που δείχνει ο άνθρωπος στην κάρτα. */
const HOVER_WIDTH_FACTOR = 2;

/** Γραμμή μέτρησης + δύο κάθετες απολήξεις, σε ΕΝΑ path οθόνης. */
function measurePath(ref: SceneScaleReference, transform: ViewTransform, viewport: Viewport): string {
  const [a, b] = worldRingToScreen(ref.segment, transform, viewport);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(len > 0)) return '';
  const n = { x: (-(b.y - a.y) / len) * TICK_HALF_PX, y: ((b.x - a.x) / len) * TICK_HALF_PX };
  const tick = (p: Point2D) => screenPointsToSvgPath([{ x: p.x - n.x, y: p.y - n.y }, { x: p.x + n.x, y: p.y + n.y }], false);
  return [screenPointsToSvgPath([a, b], false), tick(a), tick(b)].join(' ');
}

export function PlanScaleReferencesOverlay({ viewport }: Props): React.ReactElement | null {
  const { run, fusion, reading, scaleHoverTextId } = usePlanRecognitionState();
  const floorId = run?.floorId ?? null;
  const background = useFloorplanBackgroundStore((s) => (floorId ? s.floors[floorId]?.background ?? null : null));
  // ADR-040 Phase XXII.B — leaf-level transform.
  const transform = useTransformValue();

  const scene = React.useMemo(() => {
    if (!background || !fusion) return null;
    const set = planRecognitionSession.scale.references();
    return set ? sceneScaleReferences(set, background) : null;
  }, [fusion, reading, background]);

  if (!scene) return null;
  const used = planConfidenceMark('high');
  const rejected = planConfidenceMark('low');
  return (
    <svg className="absolute inset-0 size-full pointer-events-none z-10" xmlns="http://www.w3.org/2000/svg" data-testid="plan-scale-references-overlay">
      {scene.rejected.map((r) => (
        <path key={r.textId} d={worldRingToSvgPath(r.ring, transform, viewport)} fill="none" stroke={rejected.stroke}
          strokeWidth={rejected.strokeWidth * (r.textId === scaleHoverTextId ? HOVER_WIDTH_FACTOR : 1)}
          strokeDasharray={rejected.dash || undefined} data-text-id={r.textId} data-role="rejected" />
      ))}
      {scene.used.map((r) => (
        <path key={r.textId} d={measurePath(r, transform, viewport)} fill="none" stroke={used.stroke}
          strokeWidth={used.strokeWidth * (r.textId === scaleHoverTextId ? HOVER_WIDTH_FACTOR : 1)}
          strokeLinecap="round" data-text-id={r.textId} data-role="used" />
      ))}
    </svg>
  );
}
