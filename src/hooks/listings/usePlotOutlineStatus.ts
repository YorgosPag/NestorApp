'use client';

/**
 * @fileoverview **Το περίγραμμα που ισχύει — και οι πράξεις πάνω του** (ADR-920 §14.11 Ζ4): Π9 · αφαίρεση · επαναφορά σχεδίου.
 * @related services/listings/plot-outline.client (`GET` · `PATCH`) · services/filesystem/file-mutation-gateway (η επαναφορά
 *   από τον κάδο, ο ΕΝΑΣ δρόμος) · lib/terrain/plot-outline/plot-outline-status (η απάντηση)
 * @module hooks/listings/usePlotOutlineStatus
 *
 * 🔑 **Ο server κρίνει, ο browser δείχνει**: μετά από κάθε πράξη η κατάσταση **ξαναδιαβάζεται** από την πόρτα — η οθόνη δεν
 *    μαντεύει ποια απόφαση ισχύει πλέον (ο κανόνας «νικά η νεότερη» ζει σε ΕΝΑ σημείο, στον server).
 * 🔑 **Μία πράξη τη φορά** (`acting`): δεύτερο κλικ όσο τρέχει η πρώτη δεν στέλνεται.
 * ⚠️ **Καμία μπαγιάτικη απάντηση**: απάντηση παλαιότερης ανάγνωσης που φτάνει αργά αγνοείται (μετρητής).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import type { PlotOutlineAmendment } from '@/lib/terrain/plot-outline/plot-outline-confirmation';
import type { PlotOutlineStatus } from '@/lib/terrain/plot-outline/plot-outline-status';
import { restoreFileFromTrashWithPolicy } from '@/services/filesystem/file-mutation-gateway';
import {
  amendPlotOutline,
  fetchPlotOutlineStatus,
  type OwnerTerrainTarget,
  type PlotOutlineRefusal,
} from '@/services/listings/plot-outline.client';

export type PlotOutlineStatusView =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly status: PlotOutlineStatus }
  | { readonly kind: 'failed'; readonly refusal: PlotOutlineRefusal };

/** Η τελευταία πράξη και η έκβασή της — για το μήνυμα κατάστασης της κάρτας. */
export type PlotOutlineAction =
  | { readonly kind: 'idle' }
  | { readonly kind: 'acting' }
  | { readonly kind: 'done'; readonly changed: boolean }
  | { readonly kind: 'refused'; readonly refusal: PlotOutlineRefusal }
  | { readonly kind: 'restore-failed' };

export interface PlotOutlineStatusApi {
  readonly view: PlotOutlineStatusView;
  readonly action: PlotOutlineAction;
  readonly refresh: () => Promise<void>;
  readonly amend: (amendment: PlotOutlineAmendment) => Promise<void>;
  readonly restoreDrawing: (fileId: string) => Promise<void>;
}

const IDLE: PlotOutlineAction = { kind: 'idle' };

function useStatusRead(target: OwnerTerrainTarget) {
  const [view, setView] = useState<PlotOutlineStatusView>({ kind: 'loading' });
  const latest = useRef(0);
  const { ownerPropertyId } = target;
  useEffect(() => () => void (latest.current += 1), []);

  const refresh = useCallback(async () => {
    const request = (latest.current += 1);
    const outcome = await fetchPlotOutlineStatus({ kind: 'owner-property', ownerPropertyId });
    if (request !== latest.current) return;
    setView(outcome.ok ? { kind: 'ready', status: outcome.status } : { kind: 'failed', refusal: outcome.refusal });
  }, [ownerPropertyId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { view, refresh };
}

export function usePlotOutlineStatus(target: OwnerTerrainTarget): PlotOutlineStatusApi {
  const { user } = useAuth();
  const { view, refresh } = useStatusRead(target);
  const [action, setAction] = useState<PlotOutlineAction>(IDLE);
  const busy = useRef(false);

  /** Μία πράξη τη φορά· μετά, η κατάσταση ξαναδιαβάζεται από την πόρτα. */
  const act = useCallback(async (run: () => Promise<PlotOutlineAction>) => {
    if (busy.current) return;
    busy.current = true;
    setAction({ kind: 'acting' });
    try {
      setAction(await run());
      await refresh();
    } finally {
      busy.current = false;
    }
  }, [refresh]);

  const amend = useCallback((amendment: PlotOutlineAmendment) => act(async () => {
    const outcome = await amendPlotOutline(target, amendment);
    return outcome.ok ? { kind: 'done', changed: outcome.changed } : { kind: 'refused', refusal: outcome.refusal };
  }), [act, target]);

  const uid = user?.uid ?? null;
  const restoreDrawing = useCallback((fileId: string) => act(async () => {
    if (uid === null) return { kind: 'restore-failed' };
    try {
      await restoreFileFromTrashWithPolicy(fileId, 'personal', uid);
      return { kind: 'done', changed: true };
    } catch {
      return { kind: 'restore-failed' };
    }
  }), [act, uid]);

  return { view, action, refresh, amend, restoreDrawing };
}
