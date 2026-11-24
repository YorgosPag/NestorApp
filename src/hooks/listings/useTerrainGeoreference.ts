'use client';

/**
 * @fileoverview 📍 **Η γεωαναφορά του ανάγλυφου — η κατάσταση και οι δύο πράξεις πάνω της** (ADR-920 §14.12 φάση Α).
 * @related services/listings/terrain-georeference.client (`GET ?view=georeference` · `PATCH`) · ./usePlotOutlineStatus (το αδελφό:
 *   ίδιοι κανόνες) · components/terrain/georeference/TerrainGeoreferenceCard (η κάρτα)
 * @module hooks/listings/useTerrainGeoreference
 *
 * 🔑 **Ο server κρίνει, ο browser δείχνει**: μετά από κάθε πράξη η κατάσταση **ξαναδιαβάζεται** από την πόρτα.
 * 🔑 **Μία πράξη τη φορά** (`acting`): δεύτερο κλικ όσο τρέχει η πρώτη δεν στέλνεται.
 * ⚠️ **Καμία μπαγιάτικη απάντηση**: απάντηση παλαιότερης ανάγνωσης που φτάνει αργά αγνοείται (μετρητής).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  TerrainGeoreferenceAmendment,
  TerrainGeoreferenceStatus,
} from '@/lib/terrain/publication/terrain-georeference-declaration';
import type { OwnerTerrainTarget } from '@/services/listings/plot-outline.client';
import {
  amendTerrainGeoreference,
  fetchTerrainGeoreference,
  type TerrainGeoreferenceRefusal,
} from '@/services/listings/terrain-georeference.client';

/** `georeference: null` = δεν υπάρχει ανάγλυφο: η κάρτα δεν έχει τίποτα να ρωτήσει. */
export type TerrainGeoreferenceView =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly georeference: TerrainGeoreferenceStatus | null }
  | { readonly kind: 'failed'; readonly refusal: TerrainGeoreferenceRefusal };

export type TerrainGeoreferenceAction =
  | { readonly kind: 'idle' }
  | { readonly kind: 'acting' }
  | { readonly kind: 'done'; readonly changed: boolean }
  | { readonly kind: 'refused'; readonly refusal: TerrainGeoreferenceRefusal };

export interface TerrainGeoreferenceApi {
  readonly view: TerrainGeoreferenceView;
  readonly action: TerrainGeoreferenceAction;
  readonly amend: (amendment: TerrainGeoreferenceAmendment) => Promise<void>;
}

const IDLE: TerrainGeoreferenceAction = { kind: 'idle' };

/**
 * @param reliefRevision αλλάζει όποτε η πόρτα ξαναδιάβασε τον φάκελο (νέο ανάγλυφο · αλλαγή περιγράμματος) — τότε η
 *   κατάσταση ξαναδιαβάζεται: νέα σημεία μπορεί να έκαναν τη δήλωση «αδήλωτη».
 */
export function useTerrainGeoreference(target: OwnerTerrainTarget, reliefRevision: unknown): TerrainGeoreferenceApi {
  const [view, setView] = useState<TerrainGeoreferenceView>({ kind: 'loading' });
  const [action, setAction] = useState<TerrainGeoreferenceAction>(IDLE);
  const latest = useRef(0);
  const busy = useRef(false);
  const { ownerPropertyId } = target;
  useEffect(() => () => void (latest.current += 1), []);

  const refresh = useCallback(async () => {
    const request = (latest.current += 1);
    const outcome = await fetchTerrainGeoreference({ kind: 'owner-property', ownerPropertyId });
    if (request !== latest.current) return;
    setView(outcome.ok ? { kind: 'ready', georeference: outcome.georeference } : { kind: 'failed', refusal: outcome.refusal });
  }, [ownerPropertyId]);

  useEffect(() => { void refresh(); }, [refresh, reliefRevision]);

  const amend = useCallback(async (amendment: TerrainGeoreferenceAmendment) => {
    if (busy.current) return;
    busy.current = true;
    setAction({ kind: 'acting' });
    try {
      const outcome = await amendTerrainGeoreference({ kind: 'owner-property', ownerPropertyId }, amendment);
      setAction(outcome.ok ? { kind: 'done', changed: outcome.changed } : { kind: 'refused', refusal: outcome.refusal });
      await refresh();
    } finally {
      busy.current = false;
    }
  }, [ownerPropertyId, refresh]);

  return { view, action, amend };
}
