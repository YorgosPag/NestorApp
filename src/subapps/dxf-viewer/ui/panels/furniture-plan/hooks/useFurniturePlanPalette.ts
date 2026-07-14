'use client';

/**
 * ADR-654 + ADR-655 — ο κύκλος ζωής του palette «Έπιπλα Κάτοψης».
 *
 * ⚠️ ΔΡΑΣΤΙΚΑ ΑΠΛΟΥΣΤΕΡΟ ΑΠΟ ΤΟ ADR-654: τα URLs των sprites παράγονται πλέον **σύγχρονα** από το
 * asset-pack registry (`resolveFurniturePlanUrl` — καμία δικτύωση, κανένα `await`). Άρα
 * ΕΞΑΦΑΝΙΣΤΗΚΑΝ:
 *   • το per-card fire-and-forget resolve των thumbnails (+ το `useState` map του),
 *   • το `busyId` (δεν υπάρχει «απασχολημένη» κάρτα όταν δεν υπάρχει αναμονή),
 *   • το proactive prefetch ΠΡΙΝ το selection store (δεν υπάρχει race χωρίς αναμονή).
 *
 * Ό,τι απομένει είναι μία **πραγματική** ασύγχρονη ερώτηση: «δικαιούμαι αυτό το pack;» — και την
 * απαντά ο server (`useAssetPackAccess`), ποτέ ο client.
 *
 * @see ../../../../data/furniture-plan-source.ts — sync URL builder
 * @see ../../../../systems/asset-packs/use-asset-pack-access.ts — η πύλη (server-decided)
 */

import { useCallback, useMemo } from 'react';
import {
  listFurniturePlanDefs,
  type FurniturePlanDef,
} from '../../../../data/furniture-plan-catalog';
import {
  FURNITURE_PLAN_PACK_ID,
  resolveFurniturePlanUrl,
} from '../../../../data/furniture-plan-source';
import { useAssetPackAccess } from '../../../../systems/asset-packs/use-asset-pack-access';
import { setSelectedFurniturePlan } from '../../../../bim/furniture-plan/furniture-plan-selection-store';

export interface UseFurniturePlanPaletteResult {
  /** Κενό όσο φορτώνει ή όταν ο χρήστης δεν δικαιούται το pack. */
  readonly defs: readonly FurniturePlanDef[];
  /** id → thumbnail url (σύγχρονο· ποτέ κενό για γνωστό id). */
  readonly thumbnails: ReadonlyMap<string, string>;
  /** `true` όσο ο server δεν έχει απαντήσει για τα δικαιώματα. */
  readonly loading: boolean;
  /** `true` όταν ο χρήστης ΔΕΝ δικαιούται το pack ⇒ το panel δείχνει «κλειδωμένο». */
  readonly locked: boolean;
  /** Θέτει το προς-τοποθέτηση έπιπλο. `true` ⇒ ο καλών ενεργοποιεί το εργαλείο. */
  readonly selectFurniture: (def: FurniturePlanDef) => boolean;
}

export function useFurniturePlanPalette(): UseFurniturePlanPaletteResult {
  const { loading, accessible } = useAssetPackAccess(FURNITURE_PLAN_PACK_ID);

  // Χωρίς πρόσβαση δεν εκτίθεται ΤΙΠΟΤΑ στο UI — ούτε ονόματα, ούτε thumbnails.
  const defs = useMemo(() => (accessible ? listFurniturePlanDefs() : []), [accessible]);

  const thumbnails = useMemo(
    () => new Map(defs.map((def) => [def.id, resolveFurniturePlanUrl(def.id, 'thumb')])),
    [defs],
  );

  const selectFurniture = useCallback((def: FurniturePlanDef): boolean => {
    setSelectedFurniturePlan({ id: def.id, url: resolveFurniturePlanUrl(def.id, 'full') });
    return true;
  }, []);

  return {
    defs,
    thumbnails,
    loading,
    locked: !loading && !accessible,
    selectFurniture,
  };
}
