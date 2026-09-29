'use client';

/**
 * @fileoverview **Η ΑΝΙΧΝΕΥΣΗ ΧΩΡΩΝ ΣΤΟΝ ΕΠΕΞΕΡΓΑΣΤΗ** — ένας ανιχνευτής (Web Worker) ανά επεξεργαστή, προθερμασμένος στην κάτοψη
 * του ορόφου (ADR-884 Φ2στ-γ Γ3γ-2α · §4.14 · §12 Δ8.1).
 * @related `lib/spatial-tour/space-detect/space-detect-client.ts` (ο ανιχνευτής) · `viewer/tour-panorama-source.ts`
 *   (`PLAN_LARGEST_CSS_WIDTH` — το λεπτομερέστερο παράγωγο, **ίδιας προέλευσης**)
 * @module components/spatial-tour/editor/useSpaceDetector
 *
 * 🔑 **Προθέρμανση**: η κάτοψη κατεβαίνει και αποκωδικοποιείται στον Worker μόλις φανεί το βήμα — το πρώτο κλικ δεν πληρώνει
 *   λήψη. Νέος όροφος ⇒ νέα προθέρμανση· αποχώρηση ⇒ ο Worker τερματίζεται.
 * 🔑 **Getter, όχι στιγμιότυπο** (ADR-040): το `detect` διαβάζει το τρέχον URL τη στιγμή της κλήσης — ένα κλικ αμέσως μετά την
 *   αλλαγή ορόφου δεν ρωτά ποτέ την παλιά κάτοψη.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { createSpaceDetector, type SpaceDetector } from '@/lib/spatial-tour/space-detect/space-detect-client';
import type { PlanDetectRequest, PlanDetectResult } from '@/lib/spatial-tour/space-detect/space-detect-plan';
import type { TourViewerPlan } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { WorkerRpcResult } from '@/lib/workers/worker-rpc-protocol';

import { PLAN_LARGEST_CSS_WIDTH, type TourPanoramaSource } from '../viewer/tour-panorama-source';

/** Η ερώτηση χωρίς ό,τι ξέρει ήδη η κάτοψη (κλίμακα, πλάτος πρωτοτύπου). */
export type SpaceDetectAsk = Omit<PlanDetectRequest, 'metresPerPixel' | 'imageWidth'>;

export interface SpaceDetectorHandle {
  /** `failed` με `plan-unavailable` όταν ο όροφος δεν έχει βαθμονομημένη κάτοψη που σερβίρεται. */
  readonly detect: (ask: SpaceDetectAsk) => Promise<WorkerRpcResult<PlanDetectResult>>;
}

interface Target {
  readonly url: string;
  readonly metresPerPixel: number;
  readonly imageWidth: number;
}

function targetOf(source: TourPanoramaSource, plan: TourViewerPlan | null): Target | null {
  if (plan === null || plan.metresPerPixel === null) return null;
  const url = source.planImageUrl(plan, PLAN_LARGEST_CSS_WIDTH);
  return url === null ? null : { url, metresPerPixel: plan.metresPerPixel, imageWidth: plan.image.width };
}

const UNAVAILABLE: WorkerRpcResult<never> = { kind: 'failed', error: 'plan-unavailable' };

export function useSpaceDetector(source: TourPanoramaSource, plan: TourViewerPlan | null): SpaceDetectorHandle {
  const [detector] = useState<SpaceDetector>(() => createSpaceDetector());
  const target = targetOf(source, plan);
  const targetRef = useRef(target);
  const url = target?.url ?? null;

  useEffect(() => { targetRef.current = target; });
  // StrictMode: το `dispose` αφήνει τον ανιχνευτή επαναχρησιμοποιήσιμο (ο Worker ξαναγεννιέται στην επόμενη κλήση).
  useEffect(() => () => detector.dispose(), [detector]);
  useEffect(() => {
    if (url !== null) void detector.load(url);
  }, [detector, url]);

  const detect = useCallback(async (ask: SpaceDetectAsk) => {
    const current = targetRef.current;
    if (current === null) return UNAVAILABLE;
    return detector.detect(current.url, { ...ask, metresPerPixel: current.metresPerPixel, imageWidth: current.imageWidth });
  }, [detector]);

  return { detect };
}
