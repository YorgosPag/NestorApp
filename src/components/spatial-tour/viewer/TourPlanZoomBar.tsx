'use client';

/**
 * @fileoverview **«− ●—— +  ↗»** — η μεγέθυνση κάθε κάρτας ορόφου και η ανάπτυξή της (ADR-884 Φ2στ-γ Γ2 · §4.14 σημείο 5).
 * @related `tour-plan-zoom-store.ts` (ο ΕΝΑΣ κάτοχος — κάρτα και ανάπτυξη βλέπουν το ίδιο) · `lib/spatial-tour/viewer/tour-plan-zoom.ts` ·
 *   `ui/slider.tsx` (Radix, `thumbAriaLabel` — το όνομα πάει στο **thumb**, που έχει τον ρόλο `slider`)
 * @module components/spatial-tour/viewer/TourPlanZoomBar
 *
 * 🏆 **Όπως η Zillow 3D Home**: ρυθμιστικό με − και + στις άκρες και ↗ για πλήρη οθόνη, κάτω από κάθε κάτοψη.
 * 📏 **Λογαριθμική ράγα** (`zoomToUnit`/`unitToZoom`): ίση απόσταση = ίσος λόγος — 1×→2× πιάνει όσο 2,5×→5×.
 * 🔑 Το ρυθμιστικό και τα κουμπιά μεγεθύνουν γύρω από το **κέντρο του παραθύρου** (`zoomPlanTo`) — ό,τι βλέπεις μένει στη μέση.
 */

import { Expand, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { unitToZoom, zoomToUnit } from '@/lib/geometry/zoom-pan-math';
import { PLAN_ZOOM_LIMITS, stepPlanZoom, zoomPlanTo } from '@/lib/spatial-tour/viewer/tour-plan-zoom';
import type { PlanFrame } from '@/lib/spatial-tour/viewer/tour-viewer-plan';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { setPlanView, usePlanView, type TourPlanZoomStore } from './tour-plan-zoom-store';
import { TOUR_VIEWER_KEYS } from './tour-viewer-labels';

/** Βήματα της ράγας — αρκετά λεπτά ώστε το σύρσιμο να φαίνεται συνεχές, και το πληκτρολόγιο να προχωρά αισθητά (1%). */
const SLIDER_STEPS = 100;

export interface TourPlanZoomBarProps {
  readonly levelId: string;
  readonly frame: PlanFrame;
  readonly store: TourPlanZoomStore;
  /** `undefined` ⇒ χωρίς ↗ (μέσα στην ίδια την ανάπτυξη). */
  readonly onExpand?: () => void;
}

function IconAction({ label, onClick, disabled, children }: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClick} disabled={disabled} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TourPlanZoomBar({ levelId, frame, store, onExpand }: TourPlanZoomBarProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const view = usePlanView(store, levelId);
  const unit = Math.round(zoomToUnit(view.zoom, PLAN_ZOOM_LIMITS) * SLIDER_STEPS);
  const set = (next: typeof view) => setPlanView(store, levelId, next);
  return (
    <section role="group" aria-label={t(TOUR_VIEWER_KEYS.planZoom)} className="mt-1 flex items-center gap-1">
      <IconAction label={t(TOUR_VIEWER_KEYS.planZoomOut)} onClick={() => set(stepPlanZoom(frame, view, -1))} disabled={view.zoom <= PLAN_ZOOM_LIMITS.min}>
        <Minus aria-hidden className="h-4 w-4" />
      </IconAction>
      <Slider className="mx-1 flex-1" min={0} max={SLIDER_STEPS} step={1} value={[unit]} thumbAriaLabel={t(TOUR_VIEWER_KEYS.planZoom)}
        onValueChange={([u]) => set(zoomPlanTo(frame, view, unitToZoom((u ?? 0) / SLIDER_STEPS, PLAN_ZOOM_LIMITS)))} />
      <IconAction label={t(TOUR_VIEWER_KEYS.planZoomIn)} onClick={() => set(stepPlanZoom(frame, view, 1))} disabled={view.zoom >= PLAN_ZOOM_LIMITS.max}>
        <Plus aria-hidden className="h-4 w-4" />
      </IconAction>
      {onExpand !== undefined && (
        <IconAction label={t(TOUR_VIEWER_KEYS.planExpand)} onClick={onExpand}>
          <Expand aria-hidden className="h-4 w-4" />
        </IconAction>
      )}
    </section>
  );
}
