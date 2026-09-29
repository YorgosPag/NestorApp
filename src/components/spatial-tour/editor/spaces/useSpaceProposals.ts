'use client';

/**
 * @fileoverview **ΟΙ ΠΡΟΤΑΣΕΙΣ ΤΟΥ ΑΝΙΧΝΕΥΤΗ** — αυτόματα για κάθε σημείο χωρίς χώρο μόλις ανοίξει η οθόνη, με κλικ για χώρο χωρίς
 * σημείο, ξανά όταν αλλάζει το πλάτος πόρτας (ADR-884 Φ2στ-γ Γ3γ-2β · §12 Δ8.1 · Δ9.2 · Δ9.7).
 * @related `../useSpaceDetector.ts` (Worker, `latestOnly`) · `lib/spatial-tour/space-edit/tour-space-proposals.ts` (καθαρό) ·
 *   `space-editor-store.ts` (πού γράφονται)
 * @module components/spatial-tour/editor/spaces/useSpaceProposals
 *
 * 🔑 **Σειριακά, όχι παράλληλα**: ο ανιχνευτής κρατά **ένα** αίτημα σε πτήση (`latestOnly`) — παράλληλες ερωτήσεις θα
 *   ακύρωναν η μία την άλλη. Μετά από κάθε απάντηση ξαναρωτάμε «ποιο σημείο θέλει ΑΚΟΜΗ πρόταση;» (Δ8.2: η κουζίνα μέσα στην
 *   πρόταση του σαλονιού δεν παίρνει δική της).
 * 🔑 **`superseded` = σιωπή**: ένα κλικ ή μια κίνηση του ρυθμιστικού αντικατέστησε την ερώτηση — δεν είναι σφάλμα.
 * 🔑 **Getters τη στιγμή της κλήσης** (ADR-040): σημεία, γραμμές και πόρτα διαβάζονται όταν ξεκινά η ερώτηση — μια γραμμή που
 *   μόλις εγκρίθηκε μετρά αμέσως.
 */

import { useCallback, useEffect, useRef } from 'react';

import {
  proposalAsk,
  proposalKeyOfNode,
  proposalKeyOfSeed,
  seedsStillNeeded,
} from '@/lib/spatial-tour/space-edit/tour-space-proposals';
import type { PlanDetectResult, PlanSegment } from '@/lib/spatial-tour/space-detect/space-detect-plan';
import type { TourPlanXY } from '@/lib/spatial-tour/tour-graph-edit';
import type { PlacedPoint } from '@/lib/spatial-tour/viewer/tour-space-view';
import type { WorkerRpcResult } from '@/lib/workers/worker-rpc-protocol';

import type { SpaceDetectorHandle } from '../useSpaceDetector';
import {
  putProposal,
  setDetecting,
  updateSpaceEditor,
  type SpaceEditorState,
  type SpaceEditorStore,
} from './space-editor-store';

export interface SpaceProposalSources {
  /** Τα τοποθετημένα σημεία του ορόφου. */
  readonly placed: () => readonly PlacedPoint[];
  /** Όσα **δεν** έχουν εγκεκριμένο χώρο (Δ8.3), με τη σειρά τους. */
  readonly missing: () => readonly PlacedPoint[];
  readonly separations: () => readonly PlanSegment[];
  /** Οριστικό id νέου χώρου (N.6 — `actions.newSpaceId`). */
  readonly mintId: () => string;
}

export interface SpaceProposalsHandle {
  /** Πρόταση στο σημείο (κλικ) — `seedNodeId` όταν το κλικ αφορά σημείο λήψης. */
  readonly detectAt: (seed: TourPlanXY, seedNodeId: string | null) => Promise<void>;
  /** Προτάσεις για όσα σημεία δεν έχουν ακόμη (στο άνοιγμα και μετά από διαχωρισμό). */
  readonly fill: () => Promise<void>;
  /** Ξανά η επιλεγμένη πρόταση (νέο πλάτος πόρτας). */
  readonly redetectSelected: () => Promise<void>;
}

type DetectReply = WorkerRpcResult<PlanDetectResult>;

/** Η ερώτηση που έγινε — ποιος σπόρος, και αν η απάντηση γίνεται η επιλεγμένη. */
export interface DetectAsked {
  readonly seed: TourPlanXY;
  readonly seedNodeId: string | null;
  readonly select: boolean;
}

/**
 * Η απάντηση ⇒ νέα κατάσταση (καθαρό). Νέα πρόταση ⇒ **νέο οριστικό id** (`mintId`)· ίδιο κλειδί ⇒ το **ίδιο** id (μια
 * επανανίχνευση με άλλη πόρτα είναι το ίδιο σχήμα, όχι δεύτερο).
 */
export function applyDetectReply(state: SpaceEditorState, reply: DetectReply, asked: DetectAsked, mintId: () => string): SpaceEditorState {
  if (reply.kind === 'superseded') return state;
  if (reply.kind === 'failed') return { ...state, notice: reply.error === 'plan-unavailable' ? 'plan-unavailable' : 'failed' };
  const result = reply.value;
  if (!result.ok) return { ...state, notice: result.refusal };
  const { seed, seedNodeId, select } = asked;
  const key = seedNodeId === null ? proposalKeyOfSeed(seed) : proposalKeyOfNode(seedNodeId);
  const spaceId = state.proposals.find((p) => p.key === key)?.spaceId ?? mintId();
  const { outline, orthogonal, areaM2, separation } = result;
  return putProposal(state, { key, spaceId, seed, seedNodeId, source: 'detected', outline, orthogonal, areaM2, separation }, select);
}

type Ask = (seed: TourPlanXY, seedNodeId: string | null, select: boolean) => Promise<void>;

/**
 * Γέμισμα: ένα τη φορά (StrictMode τρέχει το effect δύο φορές — δύο βρόχοι θα ακύρωναν ο ένας τον άλλο στον `latestOnly`), και
 * κάθε σημείο δοκιμάζεται **μία** φορά ανά γέμισμα (μια άρνηση δεν γίνεται ατέρμονος βρόχος).
 */
function useFill(ask: Ask, store: SpaceEditorStore, missing: () => readonly PlacedPoint[]) {
  const filling = useRef(false);
  const read = useRef(missing);
  read.current = missing;
  return useCallback(async () => {
    if (filling.current) return;
    filling.current = true;
    const tried = new Set<string>();
    try {
      for (;;) {
        const next = seedsStillNeeded(read.current(), store.get().proposals).find((p) => !tried.has(p.nodeId));
        if (next === undefined) return;
        tried.add(next.nodeId);
        await ask(next.point, next.nodeId, store.get().selection === null);
      }
    } finally {
      filling.current = false;
    }
  }, [ask, store]);
}

export function useSpaceProposals(
  detector: SpaceDetectorHandle,
  store: SpaceEditorStore,
  sources: SpaceProposalSources,
): SpaceProposalsHandle {
  const latest = useRef(sources);
  latest.current = sources;

  const ask = useCallback<Ask>(async (seed, seedNodeId, select) => {
    const { placed, separations, mintId } = latest.current;
    updateSpaceEditor(store, (s) => setDetecting(s, 1));
    const reply = await detector.detect(proposalAsk(seed, seedNodeId, placed(), separations(), store.get().doorWidthM));
    updateSpaceEditor(store, (s) => applyDetectReply(setDetecting(s, -1), reply, { seed, seedNodeId, select }, mintId));
  }, [detector, store]);

  const fill = useFill(ask, store, () => latest.current.missing());
  const detectAt = useCallback(async (seed: TourPlanXY, seedNodeId: string | null) => { await ask(seed, seedNodeId, true); }, [ask]);

  const redetectSelected = useCallback(async () => {
    const selection = store.get().selection;
    const proposal = selection?.kind === 'proposal' ? store.get().proposals.find((p) => p.key === selection.key) : undefined;
    if (proposal !== undefined) await ask(proposal.seed, proposal.seedNodeId, true);
  }, [ask, store]);

  // Στο άνοιγμα: μία φορά ανά οθόνη (Matterport — τα δωμάτια περιμένουν έλεγχο, δεν ζητούνται ένα-ένα).
  useEffect(() => { void fill(); }, [fill]);

  return { detectAt, fill, redetectSelected };
}
