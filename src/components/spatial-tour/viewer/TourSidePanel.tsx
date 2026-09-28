'use client';

/**
 * @fileoverview **Η ΣΤΗΛΗ ΤΗΣ ΠΕΡΙΗΓΗΣΗΣ** — όλοι οι όροφοι, ο ένας κάτω από τον άλλο: κάτοψη με «είστε εδώ» + κώνο, και
 * **πάντα** η λίστα των σημείων (ADR-884 Φ2στ · §4.12 · Φ2στ-β · §4.13).
 * @related `TourViewer.tsx` (κάτοχος: μόνιμη στήλη σε μεγάλη οθόνη, `Sheet` στο κινητό) · `TourPlanMap.tsx` ·
 *   `TourViewerNavigation.tsx` (`TourStopList`, `useLevelLabel`) · `tour-panorama-source.ts` (`planImageUrl`)
 * @module components/spatial-tour/viewer/TourSidePanel
 *
 * 🏆 **Όπως η Zillow 3D Home**: «Jump to a panorama by tapping on a blue dot» — **όλοι** οι όροφοι ορατοί μαζί (όχι
 *   επιλογέας που κρύβει τους άλλους), ο πάνω όροφος πρώτος, ο τρέχων τονισμένος.
 * 🔑 **Χάρτης μόνο όταν υπάρχει κάτι αληθινό** (`hasPlan`): εικόνα κάτοψης (Φ2στ-β), ή θέσεις σε όλα τα σημεία. Χωρίς αυτά
 *   δεν επινοείται χάρτης — μένει η λίστα (§12 Δ5 `none`).
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TourViewerGraph } from '@/lib/spatial-tour/viewer/tour-viewer-graph';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import type { TourCameraStore } from './tour-camera-store';
import type { TourPanoramaSource } from './tour-panorama-source';
import { TOUR_VIEWER_KEYS } from './tour-viewer-labels';
import { TourPlanMap } from './TourPlanMap';
import { TourStopList, useLevelLabel } from './TourViewerNavigation';

/** Το πλάτος της στήλης σε css px — από αυτό διαλέγει η πηγή το παράγωγο της κάτοψης. */
const PANEL_PLAN_CSS_WIDTH = 400;

export interface TourSidePanelProps {
  readonly graph: TourViewerGraph;
  readonly currentNodeId: string | null;
  readonly camera: TourCameraStore;
  readonly onGo: (nodeId: string) => void;
  readonly source: TourPanoramaSource;
}

export function TourSidePanel({ graph, currentNodeId, camera, onGo, source }: TourSidePanelProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const labelOf = useLevelLabel();
  const currentLevelId = currentNodeId === null ? null : graph.stops.get(currentNodeId)?.levelId ?? null;
  return (
    <nav aria-label={t(TOUR_VIEWER_KEYS.panelTitle)} className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted-foreground">{t(TOUR_VIEWER_KEYS.panelHint)}</p>
      {[...graph.levels].reverse().map((level) => {
        const planImageUrl = level.plan === null ? null : source.planImageUrl(level.plan, PANEL_PLAN_CSS_WIDTH);
        return (
          <section key={level.id} aria-label={labelOf(level)}
            className={level.id === currentLevelId ? 'rounded-lg border border-ring bg-card p-3' : 'rounded-lg border border-border bg-card p-3'}>
            <h2 className="mb-2 mt-0 text-sm font-semibold text-foreground">{labelOf(level)}</h2>
            {level.hasPlan && (
              <figure className="m-0 mb-2 aspect-[4/3] w-full rounded-md bg-muted p-1">
                <TourPlanMap graph={graph} level={level} currentNodeId={currentNodeId} camera={camera} onGo={onGo} planImageUrl={planImageUrl} />
              </figure>
            )}
            <TourStopList graph={graph} level={level} currentNodeId={currentNodeId} onGo={onGo} />
          </section>
        );
      })}
    </nav>
  );
}
