/**
 * ADR-419 §gap-close — listener που κλείνει τον ανοιχτό βρόχο μετά από «Ναι».
 *
 * Όταν το region/perimeter detection εντοπίζει ΜΗ κλειστό βρόχο με 2 ανοιχτά άκρα,
 * το region-click emit-άρει `bim:region-gap-detected`. Αυτός ο hook ρωτά τον χρήστη
 * («Να κλείσω το κενό;») και, στο «Ναι», προσθέτει μια γραμμή που ενώνει τα δύο άκρα
 * (κλείνει τον βρόχο) μέσω του κοινού undoable `appendEntityToScene` SSoT — ο χρήστης
 * μετά ξανακλικάρει και το πλέον-κλειστό περίγραμμα γεμίζει με τοίχο.
 *
 * Mount στο `useSpecialTools` (έχει τον `levelManager` = scene accessor).
 *
 * @see ../../bim/walls/gap-close-confirm-store.ts
 * @see ../../bim/scene/append-entity-to-scene.ts
 */

import { useEffect } from 'react';
import { generateEntityId } from '@/services/enterprise-id.service';
import { EventBus } from '../../systems/events/EventBus';
import type { LineEntity } from '../../types/entities';
import { appendEntityToScene, type SceneAppendAccessor } from '../../bim/scene/append-entity-to-scene';
import { requestGapCloseConfirm } from '../../bim/walls/gap-close-confirm-store';

export function useRegionGapClose(accessor: SceneAppendAccessor): void {
  useEffect(() => {
    return EventBus.on('bim:region-gap-detected', ({ start, end, layerId }) => {
      void requestGapCloseConfirm(start, end).then((action) => {
        if (action !== 'close') return;
        // Η γραμμή-ένωσης κληρονομεί το layer της ανοιχτής παρειάς ώστε να είναι
        // ομοιογενής με το υπόλοιπο περίγραμμα (visible:true — αλλιώς εξαιρείται από snap).
        const line: LineEntity = {
          id: generateEntityId(),
          type: 'line',
          visible: true,
          start: { x: start.x, y: start.y },
          end: { x: end.x, y: end.y },
          layerId,
        };
        appendEntityToScene(accessor, line, 'line');
      });
    });
  }, [accessor]);
}
