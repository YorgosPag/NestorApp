'use client';

/**
 * ADR-654 M6 / ADR-655 — ο κύκλος ζωής του generic entourage palette.
 *
 * Γενίκευση του `useFurniturePlanPalette`: τα URLs παράγονται **σύγχρονα** από το asset-pack
 * registry (`descriptor.resolveUrl` — καμία δικτύωση, κανένα `await`, κανένα prefetch/race). Η μόνη
 * πραγματική ασύγχρονη ερώτηση είναι «δικαιούμαι αυτό το pack;» — την απαντά ο server, ποτέ ο client.
 *
 * @see ./entourage-pack-descriptor.ts — τι δίνει η κάθε οικογένεια
 * @see ../../../systems/asset-packs/use-asset-pack-access.ts — η πύλη (server-decided)
 */

import { useCallback, useMemo } from 'react';
import type { EntourageDef } from '../../../data/entourage-catalog-core';
import { useAssetPackAccess } from '../../../systems/asset-packs/use-asset-pack-access';
import type { EntouragePackDescriptor } from './entourage-pack-descriptor';

export interface UseEntouragePaletteResult {
  /** Κενό όσο φορτώνει ή όταν ο χρήστης δεν δικαιούται το pack. */
  readonly defs: readonly EntourageDef[];
  /** id → thumbnail url (σύγχρονο· ποτέ κενό για γνωστό id). */
  readonly thumbnails: ReadonlyMap<string, string>;
  /** `true` όσο ο server δεν έχει απαντήσει για τα δικαιώματα. */
  readonly loading: boolean;
  /** `true` όταν ο χρήστης ΔΕΝ δικαιούται το pack ⇒ το panel δείχνει «κλειδωμένο». */
  readonly locked: boolean;
  /** Θέτει το προς-τοποθέτηση item. `true` ⇒ ο καλών ενεργοποιεί το εργαλείο. */
  readonly selectItem: (def: EntourageDef) => boolean;
}

export function useEntouragePalette(
  descriptor: EntouragePackDescriptor,
): UseEntouragePaletteResult {
  const { packId, list, resolveUrl, selection } = descriptor;
  const { loading, accessible } = useAssetPackAccess(packId);

  // Χωρίς πρόσβαση δεν εκτίθεται ΤΙΠΟΤΑ στο UI — ούτε ονόματα, ούτε thumbnails.
  const defs = useMemo(() => (accessible ? list() : []), [accessible, list]);

  const thumbnails = useMemo(
    () => new Map(defs.map((def) => [def.id, resolveUrl(def.id, 'thumb')])),
    [defs, resolveUrl],
  );

  const selectItem = useCallback(
    (def: EntourageDef): boolean => {
      selection.set({ id: def.id, url: resolveUrl(def.id, 'full') });
      return true;
    },
    [selection, resolveUrl],
  );

  return {
    defs,
    thumbnails,
    loading,
    locked: !loading && !accessible,
    selectItem,
  };
}
