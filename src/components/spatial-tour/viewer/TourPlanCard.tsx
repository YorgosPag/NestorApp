'use client';

/**
 * @fileoverview **Η ΚΑΤΟΨΗ ΕΝΟΣ ΟΡΟΦΟΥ ΣΤΗ ΣΤΗΛΗ** — χάρτης + «− ●—— +  ↗» + η ανάπτυξή της σε πλήρη οθόνη (ADR-884 Φ2στ-γ Γ2 ·
 * §4.14 σημεία 3 + 5).
 * @related `TourSidePanel.tsx` (κάτοχος) · `TourPlanMap.tsx` · `TourPlanZoomBar.tsx` · `tour-plan-zoom-store.ts` (κοινή θέαση)
 * @module components/spatial-tour/viewer/TourPlanCard
 *
 * 🔑 **Το κάδρο υπολογίζεται ΜΙΑ φορά εδώ** (`levelPlanFrame`) και το μοιράζονται χάρτης, μπάρα και ανάπτυξη — το ζουμ
 *   υπολογίζεται πάνω στο ίδιο κάδρο που ζωγραφίζεται.
 * 🔑 **Η εικόνα ακολουθεί το ΠΡΑΓΜΑΤΙΚΟ πλάτος** (μετρημένο, όχι σταθερά 400 px) **επί το ζουμ**: η στήλη που πλαταίνει ή η
 *   κάτοψη που μεγεθύνεται ζητά μεγαλύτερο παράγωγο· η αλλαγή γίνεται χωρίς κενό (`useDecodedImageUrl`).
 * 🏆 **Ανάπτυξη** (↗): `Dialog size="fullscreen"` (πρότυπο `FloorplanGallery`, ADR-241) με τον **ίδιο** χάρτη και την
 *   **ίδια** θέαση — ό,τι μεγέθυνες στη στήλη το βρίσκεις εκεί, και αντίστροφα. Εκεί ο σκέτος τροχός μεγεθύνει. Κλικ σε
 *   τελεία ⇒ μετάβαση **και** κλείσιμο: ο επισκέπτης βλέπει αμέσως το νέο πανόραμα (Zillow).
 */

import { useCallback, useRef, useState } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useDecodedImageUrl } from '@/hooks/media/useDecodedImageUrl';
import { useElementSize } from '@/hooks/media/useElementSize';
import type { TourViewerGraph, ViewerLevelEntry } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import { levelPlanFrame, placedStops, type PlacedStop, type PlanFrame } from '@/lib/spatial-tour/viewer/tour-viewer-plan';
import { PLAN_FALLBACK_SURFACE_PX } from '@/lib/spatial-tour/viewer/tour-plan-zoom';

import type { TourCameraStore } from './tour-camera-store';
import type { TourPanoramaSource } from './tour-panorama-source';
import { usePlanView, type TourPlanZoomStore } from './tour-plan-zoom-store';
import { TourPlanMap } from './TourPlanMap';
import { TourPlanAreaNote } from './TourPlanSpaces';
import { TourPlanZoomBar } from './TourPlanZoomBar';
import type { PlanWheelMode } from './usePlanZoomGestures';

/**
 * Σκαλοπάτι μέτρησης (css px): αρκετά λεπτό ώστε οι τελείες να μη «χοροπηδούν» όταν σέρνεται η στήλη, αρκετά χοντρό ώστε το
 * σύρσιμο να μην ξαναζωγραφίζει την κάτοψη σε κάθε pixel. Η **εικόνα** αλλάζει πολύ σπανιότερα: η πηγή διαλέγει παράγωγο.
 */
const SIZE_STEP_PX = 4;

export interface TourPlanCardProps {
  readonly graph: TourViewerGraph;
  readonly level: ViewerLevelEntry;
  /** Ο όροφος στη γλώσσα του επισκέπτη — τίτλος της ανάπτυξης. */
  readonly label: string;
  readonly currentNodeId: string | null;
  readonly camera: TourCameraStore;
  readonly onGo: (nodeId: string) => void;
  readonly source: TourPanoramaSource;
  readonly zoomStore: TourPlanZoomStore;
}

interface PlanSurfaceProps extends Omit<TourPlanCardProps, 'label' | 'source'> {
  readonly frame: PlanFrame;
  readonly stops: readonly PlacedStop[];
  readonly source: TourPanoramaSource;
  readonly wheelMode: PlanWheelMode;
  readonly className: string;
}

/** Ο χάρτης μέσα σε κουτί που μετριέται — κοινός για κάρτα και ανάπτυξη. */
function PlanSurface({ source, level, zoomStore, className, ...map }: PlanSurfaceProps) {
  const box = useRef<HTMLElement | null>(null);
  const surface = useElementSize(box, SIZE_STEP_PX);
  const view = usePlanView(zoomStore, level.id);
  const wanted = level.plan === null ? null : source.planImageUrl(level.plan, (surface.width || PLAN_FALLBACK_SURFACE_PX) * view.zoom);
  const planImageUrl = useDecodedImageUrl(wanted);
  return (
    <figure ref={box} className={className}>
      <TourPlanMap {...map} level={level} zoomStore={zoomStore} planImageUrl={planImageUrl} surface={surface} />
    </figure>
  );
}

export function TourPlanCard({ label, onGo, ...props }: TourPlanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const stops = placedStops(props.graph, props.level);
  // Το κάδρο της εικόνας μόνο όταν η πηγή **δίνει** εικόνα (η εικονική πηγή του demo δεν δίνει) — ίδιο κριτήριο με τη Φ2στ-β.
  const showsImage = props.level.plan !== null && props.source.planImageUrl(props.level.plan, PLAN_FALLBACK_SURFACE_PX) !== null;
  const frame = levelPlanFrame(props.level, stops, showsImage);
  const goAndClose = useCallback((nodeId: string) => { setExpanded(false); onGo(nodeId); }, [onGo]);
  if (frame === null) return null;
  const common = { ...props, frame, stops };
  return (
    <>
      <PlanSurface {...common} onGo={onGo} wheelMode="modifier" className="m-0 aspect-[4/3] w-full overflow-hidden rounded-md bg-muted" />
      <TourPlanZoomBar levelId={props.level.id} frame={frame} store={props.zoomStore} onExpand={() => setExpanded(true)} />
      {showsImage && <TourPlanAreaNote level={props.level} areas={props.graph.spaceAreas} />}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent size="fullscreen" className="flex flex-col gap-2 p-4" aria-describedby={undefined}>
          <DialogTitle className="m-0 text-base">{label}</DialogTitle>
          <PlanSurface {...common} onGo={goAndClose} wheelMode="always" className="m-0 min-h-0 flex-1 overflow-hidden rounded-md bg-muted" />
          <TourPlanZoomBar levelId={props.level.id} frame={frame} store={props.zoomStore} />
          {showsImage && <TourPlanAreaNote level={props.level} areas={props.graph.spaceAreas} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
