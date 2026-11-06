'use client';

/**
 * 🏛️ ADR-931 Β1 — η ομάδα (λεξιλόγιο) του κοινόχρηστου χώρου που οριοθετεί κάθε περίγραμμα `common_space`,
 * για το σχήμα χρωμάτων του καμβά (Revit Color Fill Scheme «by parameter» · ArchiCAD Zone Category).
 *
 * - Συνδρομή **μόνο** όταν υπάρχει τουλάχιστον ένα περίγραμμα κοινόχρηστου (καμία κόστος αλλιώς).
 * - Ο χώρος διαβάζεται από τον ΕΝΑ mapper (`useFirestoreCommonSpaces` → `mapCommonSpaceDoc`) — κανένα δεύτερο σχήμα.
 * - ADR-040: ο καλών είναι ο orchestrator (`CanvasSection` → `useOverlayLayers`). Χαμηλής συχνότητας `onSnapshot`,
 *   όχι `useSyncExternalStore`· ο χάρτης κρατά **σταθερή αναφορά** όσο δεν αλλάζει το περιεχόμενό του
 *   (μεταβολή που δεν αγγίζει κατηγορία ⇒ καμία επανασχεδίαση του καμβά).
 *
 * @see src/subapps/dxf-viewer/config/color-mapping.ts — `getCommonSpaceColors`
 */

import { useMemo, useRef } from 'react';
import { useFirestoreCommonSpaces } from '@/hooks/useFirestoreCommonSpaces';
import { commonSpaceGroupOf, type CommonSpaceGroup } from '@/constants/common-space-categories';
import { linkedEntityIdOf } from '@/types/floorplan-overlays';
import type { Overlay } from '../../overlays/types';

type GroupBySpaceId = ReadonlyMap<string, CommonSpaceGroup>;

function sameGroups(a: GroupBySpaceId, b: GroupBySpaceId): boolean {
  if (a.size !== b.size) return false;
  for (const [id, group] of a) {
    if (b.get(id) !== group) return false;
  }
  return true;
}

/** `spaceId → ομάδα` για τους χώρους που δένουν τα περιγράμματα· χώρος που λείπει ⇒ καμία γραμμή (ουδέτερο χρώμα). */
export function useCommonSpaceOverlayGroups(overlays: readonly Overlay[]): GroupBySpaceId {
  const linkedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const overlay of overlays) {
      const id = overlay.kind === 'common_space' ? linkedEntityIdOf('common_space', overlay.linked) : undefined;
      if (id !== undefined) ids.add(id);
    }
    return ids;
  }, [overlays]);

  const { commonSpaces } = useFirestoreCommonSpaces({ enabled: linkedIds.size > 0 });
  const stableRef = useRef<GroupBySpaceId>(new Map());

  return useMemo(() => {
    const next = new Map<string, CommonSpaceGroup>();
    for (const space of commonSpaces) {
      if (linkedIds.has(space.id)) next.set(space.id, commonSpaceGroupOf(space.category));
    }
    if (!sameGroups(stableRef.current, next)) stableRef.current = next;
    return stableRef.current;
  }, [commonSpaces, linkedIds]);
}
