'use client';

/**
 * @fileoverview **Το ανάγλυφο όπως το βλέπει ο ιδιοκτήτης** — με το περίγραμμα πάνω του, ό,τι κι αν λέει το Π9 (ADR-920 §14.11 Ζ5).
 * @related services/listings/plot-outline.client (`fetchOwnerRelief` — `GET …/terrain?view=relief`) ·
 *   ./usePlotOutlineStatus (η κατάσταση που λέει ΠΟΤΕ έχει νόημα να ζητηθεί) ·
 *   components/terrain/plot-outline/PlotOutlineOnRelief (ο καταναλωτής)
 * @module hooks/listings/useOwnerRelief
 *
 * 🔑 **Ακολουθεί την κατάσταση, δεν τη μαντεύει**: ζητείται ξανά κάθε φορά που η κατάσταση ξαναδιαβάζεται από την πόρτα
 *    (επιβεβαίωση · αφαίρεση · επαναφορά σχεδίου) — ο χάρτης δείχνει ό,τι ισχύει, όχι ό,τι ίσχυε.
 * 🔑 **Ποτέ κενό ανάμεσα σε δύο απαντήσεις**: όσο έρχεται η νεότερη, μένει η προηγούμενη σκηνή (`updating`).
 * ⚠️ **Καμία μπαγιάτικη απάντηση**: απάντηση παλαιότερου αιτήματος που φτάνει αργά αγνοείται (μετρητής).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { PlotOutlineStatus } from '@/lib/terrain/plot-outline/plot-outline-status';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import { fetchOwnerRelief, type OwnerTerrainTarget, type PlotOutlineRefusal } from '@/services/listings/plot-outline.client';

export interface OwnerReliefApi {
  /** Η τελευταία σκηνή που διαβάστηκε — μένει όσο έρχεται νεότερη. */
  readonly snapshot: ListingTerrainSnapshot | null;
  readonly updating: boolean;
  /** Η τελευταία ανάγνωση απέτυχε (`null` = όχι). */
  readonly refusal: PlotOutlineRefusal | null;
  readonly retry: () => void;
}

interface ReliefState {
  readonly snapshot: ListingTerrainSnapshot | null;
  readonly updating: boolean;
  readonly refusal: PlotOutlineRefusal | null;
}

const EMPTY: ReliefState = { snapshot: null, updating: false, refusal: null };

/** Έχει νόημα ο χάρτης μόνο όταν υπάρχουν ΚΑΙ ανάγλυφο ΚΑΙ περίγραμμα πάνω του. */
export function ownerReliefApplies(status: PlotOutlineStatus | null): boolean {
  return status !== null && status.hasRelief && status.outline !== null;
}

/**
 * @param status Η κατάσταση όπως τη διάβασε η πόρτα (`null` = δεν διαβάστηκε ακόμη). Νέο αντικείμενο ανά ανάγνωση ⇒ νέο αίτημα.
 */
export function useOwnerRelief(target: OwnerTerrainTarget, status: PlotOutlineStatus | null): OwnerReliefApi {
  const [state, setState] = useState<ReliefState>(EMPTY);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);
  const { ownerPropertyId } = target;
  const applies = ownerReliefApplies(status);

  useEffect(() => {
    const request = (latest.current += 1);
    if (!applies) {
      setState(EMPTY);
      return;
    }
    setState((previous) => ({ snapshot: previous.snapshot, updating: true, refusal: null }));
    void fetchOwnerRelief({ kind: 'owner-property', ownerPropertyId }).then((outcome) => {
      if (request !== latest.current) return;
      setState(outcome.ok
        ? { snapshot: outcome.snapshot, updating: false, refusal: null }
        : { snapshot: null, updating: false, refusal: outcome.refusal });
    });
    // `status`: νέα ανάγνωση της πόρτας ⇒ νέο αίτημα, ακόμη κι αν το `applies` δεν άλλαξε (άλλο περίγραμμα, ίδιο «υπάρχει»).
  }, [applies, ownerPropertyId, status, attempt]);

  useEffect(() => () => void (latest.current += 1), []);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, retry };
}
