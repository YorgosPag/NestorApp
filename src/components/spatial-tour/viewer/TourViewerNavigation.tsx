'use client';

/**
 * @fileoverview **ΟΡΟΦΟΙ ΚΑΙ ΕΠΟΜΕΝΑ ΣΗΜΕΙΑ** — η πλοήγηση του θεατή **έξω** από την εικόνα (ADR-884 Φ1 · §4.8).
 * @related `TourViewer.tsx` (κάτοχος) · `lib/spatial-tour/viewer/tour-viewer-graph.ts`
 * @module components/spatial-tour/viewer/TourViewerNavigation
 *
 * 🔑 **Η λίστα «Επόμενα σημεία» υπάρχει ΠΑΝΤΑ**, όχι μόνο σε όροφο χωρίς κάτοψη: είναι ο δρόμος του αναγνώστη οθόνης και
 *   του πληκτρολογίου που δεν χρειάζεται να «βρει» κουμπί πάνω σε εικόνα που κινείται. Σε όροφο χωρίς κάτοψη είναι ο **μόνος**
 *   δρόμος — και δεν επινοεί θέση.
 * 🔑 Όροφοι: επιλογέας της Matterport — αλλαγή ορόφου ⇒ η πρώτη στάση του ορόφου.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ViewerLevelEntry, ViewerNeighbour } from '@/lib/spatial-tour/viewer/tour-viewer-graph';

import { Button } from '@/components/ui/button';
import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_VIEWER_KEYS } from './tour-viewer-labels';

/** Η ετικέτα ορόφου — η δηλωμένη, αλλιώς «Όροφος {n}». Ένας κανόνας για επιλογέα και λίστα χωρίς WebGL. */
export function useLevelLabel(): (level: Pick<ViewerLevelEntry, 'label' | 'ordinal'>) => string {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (level) => level.label ?? t(TOUR_VIEWER_KEYS.floorNumbered, { ordinal: level.ordinal });
}

/**
 * Ετικέτα + `aria-label` ενός γείτονα — με τον όροφο όταν η σκάλα οδηγεί σε **άλλον** («Σημείο 1 · Όροφος 1»).
 * Ένας κανόνας για τα κουμπιά πάνω στην εικόνα **και** τη λίστα.
 */
export function useNeighbourLabels(levels: readonly ViewerLevelEntry[], currentLevelId: string | null) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const labelOf = useLevelLabel();
  return (n: ViewerNeighbour): { readonly text: string; readonly aria: string } => {
    const level = n.levelId === currentLevelId ? undefined : levels.find((l) => l.id === n.levelId);
    if (level === undefined) {
      return { text: t(TOUR_VIEWER_KEYS.point, { number: n.number }), aria: t(TOUR_VIEWER_KEYS.goTo, { number: n.number }) };
    }
    const floor = labelOf(level);
    return {
      text: t(TOUR_VIEWER_KEYS.pointOnFloor, { number: n.number, floor }),
      aria: t(TOUR_VIEWER_KEYS.goToOnFloor, { number: n.number, floor }),
    };
  };
}

export function TourFloorSwitcher({ levels, currentLevelId, onSelect }: {
  readonly levels: readonly ViewerLevelEntry[];
  readonly currentLevelId: string | null;
  readonly onSelect: (levelId: string) => void;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const labelOf = useLevelLabel();
  if (levels.length < 2) return null;
  return (
    <nav aria-label={t(TOUR_VIEWER_KEYS.floors)}>
      <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
        {[...levels].reverse().map((level) => (
          <li key={level.id}>
            <Button type="button" size="sm" variant={level.id === currentLevelId ? 'default' : 'outline'}
              aria-pressed={level.id === currentLevelId} onClick={() => onSelect(level.id)}>
              {labelOf(level)}
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function TourNearbyList({ neighbours, levels, currentLevelId, onGo }: {
  readonly neighbours: readonly ViewerNeighbour[];
  readonly levels: readonly ViewerLevelEntry[];
  readonly currentLevelId: string | null;
  readonly onGo: (nodeId: string) => void;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const labelsOf = useNeighbourLabels(levels, currentLevelId);
  if (neighbours.length === 0) return null;
  return (
    <nav aria-label={t(TOUR_VIEWER_KEYS.nearby)}>
      <h2 className="mb-1 text-sm font-medium text-muted-foreground">{t(TOUR_VIEWER_KEYS.nearby)}</h2>
      <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
        {neighbours.map((n) => {
          const label = labelsOf(n);
          return (
            <li key={n.nodeId}>
              <Button type="button" size="sm" variant="secondary" aria-label={label.aria} onClick={() => onGo(n.nodeId)}>
                {label.text}
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
