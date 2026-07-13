'use client';

/**
 * ADR-654 — ο κύκλος ζωής του palette «Έπιπλα Κάτοψης».
 *
 * Mirror του `useBlockLibraryPalette` (ADR-652 M2), απλοποιημένο: εδώ δεν υπάρχει
 * session/cloud merge ούτε save/promote/delete — μόνο ένας σταθερός curated κατάλογος
 * (`listFurniturePlanDefs`) και ΔΥΟ ενέργειες:
 *
 *  - **thumbnails**: resolve μία φορά, στο mount, το `variant: 'thumb'` URL κάθε ορισμού
 *    (fire-and-forget ανά κάρτα — μία αργή/αποτυχημένη κάρτα δεν μπλοκάρει τις άλλες).
 *  - **selectFurniture**: resolve το `variant: 'full'` URL ΠΡΙΝ γράψει στο selection store
 *    (proactive prefetch — το placement tool διαβάζει το url σε event-time, βλ.
 *    `furniture-plan-selection-store.ts`). Ο καλών (panel) ενεργοποιεί το εργαλείο ΜΟΝΟ
 *    αν αυτό γυρίσει `true` — ίδιο σχήμα με `selectEntry` → `onSelectBlock`.
 *
 * @see ../../../../data/furniture-plan-catalog.ts — τα defs (id/category/aspect)
 * @see ../../../../data/furniture-plan-source.ts — ο async resolver (thumb/full)
 * @see ../../../../bim/furniture-plan/furniture-plan-selection-store.ts — «ποιο έπιπλο» SSoT
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listFurniturePlanDefs,
  type FurniturePlanDef,
} from '../../../../data/furniture-plan-catalog';
import { resolveFurniturePlanUrl } from '../../../../data/furniture-plan-source';
import { setSelectedFurniturePlan } from '../../../../bim/furniture-plan/furniture-plan-selection-store';

export interface UseFurniturePlanPaletteResult {
  readonly defs: readonly FurniturePlanDef[];
  /** id → resolved thumbnail url, ή `null` αν απέτυχε το resolve. Απόν ⇒ ακόμα φορτώνει. */
  readonly thumbnails: ReadonlyMap<string, string>;
  /** Το id της κάρτας που κάνει resolve του FULL url αυτή τη στιγμή. */
  readonly busyId: string | null;
  readonly error: string | null;
  /** Resolve FULL url + set selection store. `true` ⇒ ο καλών ενεργοποιεί το εργαλείο. */
  readonly selectFurniture: (def: FurniturePlanDef) => Promise<boolean>;
}

/** Φορτώνει τα thumbnails ΟΛΩΝ των defs, μία φορά· fire-and-forget ανά κάρτα (N.7.2 §6). */
function useFurnitureThumbnails(
  defs: readonly FurniturePlanDef[],
): ReadonlyMap<string, string> {
  const [thumbnails, setThumbnails] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    for (const def of defs) {
      resolveFurniturePlanUrl(def.id, 'thumb').then((url) => {
        if (cancelled || !url) return;
        setThumbnails((prev) => {
          const next = new Map(prev);
          next.set(def.id, url);
          return next;
        });
      });
    }
    return () => {
      cancelled = true;
    };
  }, [defs]);

  return thumbnails;
}

export function useFurniturePlanPalette(): UseFurniturePlanPaletteResult {
  const defs = useMemo(() => listFurniturePlanDefs(), []);
  const thumbnails = useFurnitureThumbnails(defs);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectFurniture = useCallback(async (def: FurniturePlanDef): Promise<boolean> => {
    setError(null);
    setBusyId(def.id);
    try {
      const url = await resolveFurniturePlanUrl(def.id, 'full');
      if (!url) {
        setError('resolveFailed');
        return false;
      }
      setSelectedFurniturePlan({ id: def.id, url });
      return true;
    } finally {
      setBusyId(null);
    }
  }, []);

  return { defs, thumbnails, busyId, error, selectFurniture };
}
