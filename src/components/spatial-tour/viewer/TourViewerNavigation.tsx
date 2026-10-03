'use client';

/**
 * @fileoverview **ΟΡΟΦΟΙ ΚΑΙ ΣΗΜΕΙΑ** — η πλοήγηση του θεατή **έξω** από την εικόνα (ADR-884 Φ1 · §4.8 · Φ2στ · §4.12).
 * @related `TourSidePanel.tsx` (η στήλη που τα φιλοξενεί) · `useStopNames.ts` (τα ονόματα) ·
 *   `lib/spatial-tour/viewer/tour-viewer-graph.ts`
 * @module components/spatial-tour/viewer/TourViewerNavigation
 *
 * 🔑 **Η λίστα σημείων υπάρχει ΠΑΝΤΑ** (κάθε όροφος, κάθε σημείο): είναι ο δρόμος του αναγνώστη οθόνης και του
 *   πληκτρολογίου που δεν χρειάζεται να «βρει» κουμπί πάνω σε εικόνα που κινείται. Σε όροφο χωρίς κάτοψη είναι ο **μόνος**
 *   δρόμος — και δεν επινοεί θέση. Πρότυπο Zillow 3D Home: «Jump to a panorama» σε **οποιοδήποτε** σημείο, όχι μόνο γείτονα.
 */

import { Button } from '@/components/ui/button';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { TourViewerGraph, ViewerLevelEntry, ViewerNeighbour } from '@/lib/spatial-tour/viewer/tour-viewer-graph';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_VIEWER_KEYS } from './tour-viewer-labels';
import { useLevelLabel } from './useLevelLabel';
import { useStopNames } from './useStopNames';

/**
 * Ετικέτα + `aria-label` ενός γείτονα — με τον όροφο όταν η σκάλα οδηγεί σε **άλλον** («Σοφίτα · Όροφος 1»).
 * Ένας κανόνας για τα βελάκια πάνω στην εικόνα.
 */
export function useNeighbourLabels(graph: TourViewerGraph, currentLevelId: string | null) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const labelOf = useLevelLabel();
  const nameOf = useStopNames(graph);
  return (n: ViewerNeighbour): { readonly text: string; readonly aria: string } => {
    const name = nameOf(n.nodeId);
    const level = n.levelId === currentLevelId ? undefined : graph.levels.find((l) => l.id === n.levelId);
    if (level === undefined) return { text: name, aria: t(TOUR_VIEWER_KEYS.goTo, { name }) };
    const floor = labelOf(level);
    return { text: t(TOUR_VIEWER_KEYS.placeOnFloor, { name, floor }), aria: t(TOUR_VIEWER_KEYS.goToOnFloor, { name, floor }) };
  };
}

/** Τα σημεία ενός ορόφου — το τρέχον σημειωμένο (`aria-current`), τα άλλα κουμπιά μετάβασης. */
export function TourStopList({ graph, level, currentNodeId, onGo }: {
  readonly graph: TourViewerGraph;
  readonly level: ViewerLevelEntry;
  readonly currentNodeId: string | null;
  readonly onGo?: (nodeId: string) => void;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const nameOf = useStopNames(graph);
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {level.nodeIds.map((nodeId) => {
        const name = nameOf(nodeId);
        const here = nodeId === currentNodeId;
        return (
          <li key={nodeId}>
            {onGo === undefined
              ? <span className="text-sm">{name}</span>
              : (
                <Button type="button" size="sm" variant="ghost" className={cn('w-full justify-start', here && COLOR_BRIDGE.selectionControl.pressed)}
                  aria-current={here ? 'location' : undefined} aria-label={here ? t(TOUR_VIEWER_KEYS.youAreHere, { name }) : t(TOUR_VIEWER_KEYS.goTo, { name })}
                  onClick={() => onGo(nodeId)}>
                  {name}
                </Button>
              )}
          </li>
        );
      })}
    </ul>
  );
}
