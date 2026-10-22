/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΣΕΛΙΔΑΣ ΕΠΑΛΗΘΕΥΣΗΣ** — τρία hooks, ένα ανά ερώτηση (ADR-916 Φ-Γ2 Σ6).
 * @module components/handover-protocol-verify/use-handover-protocol-verification
 *
 * - `useHandoverProtocolCheck` — «είναι **αυτό** το αρχείο το γνήσιο, τρέχον Πρωτόκολλο;»
 * - `useHandoverProtocolRecord` — «τι λέει το μητρώο για τον κωδικό του χαρτιού;» (QR, χωρίς αρχείο)
 * - `useHandoverPackageCheck` — «είναι τα αρχεία που πήρα **αυτά** του πίνακα;»
 *
 * 🔴 **Μηδέν συνθήκες ανταγωνισμού**: κάθε εκτέλεση παίρνει αύξοντα αριθμό· ό,τι επιστρέφει από **παλιότερη** εκτέλεση
 *    (ο άνθρωπος έριξε δεύτερο αρχείο πριν τελειώσει το πρώτο) **αγνοείται**. Το ίδιο και μετά το unmount.
 */

import React from 'react';

import {
  handoverPackageCheckOf,
  type HandoverPackageCheck,
  type HandoverPackageFileEvidence,
} from '@/lib/property-handover/handover-protocol-package-check';
import type { HandoverProtocolManifest } from '@/lib/property-handover/handover-protocol-manifest-parse';
import {
  handoverProtocolVerdictOf,
  type HandoverProtocolRegistryAnswer,
  type HandoverProtocolVerdict,
} from '@/lib/property-handover/handover-protocol-verification';

import { packageFileEvidenceOf, readProtocolLocally, type ProtocolLocalRefusal } from './protocol-local-read';
import { askProtocolRegistry, type ProtocolRegistryUnavailable } from './protocol-registry-client';

/** Αριθμός εκτέλεσης + «ζει ακόμη;» — η μία ραφή κατά των καθυστερημένων απαντήσεων. */
function useLatestRun(): { readonly begin: () => () => boolean } {
  const run = React.useRef(0);
  React.useEffect(() => () => {
    run.current += 1;
  }, []);
  const begin = React.useCallback(() => {
    run.current += 1;
    const mine = run.current;
    return () => run.current === mine;
  }, []);
  return { begin };
}

export type HandoverProtocolCheckState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'reading'; readonly fileName: string }
  | { readonly phase: 'refused'; readonly fileName: string; readonly reason: ProtocolLocalRefusal }
  | { readonly phase: 'inconsistent'; readonly fileName: string; readonly manifest: HandoverProtocolManifest }
  | { readonly phase: 'asking'; readonly fileName: string; readonly manifest: HandoverProtocolManifest }
  | { readonly phase: 'unavailable'; readonly fileName: string; readonly reason: ProtocolRegistryUnavailable }
  | { readonly phase: 'judged'; readonly fileName: string; readonly verdict: HandoverProtocolVerdict };

/** **Ελέγχει ένα αρχείο.** `expectedProtocolId` ⇒ η σελίδα άνοιξε από QR συγκεκριμένου πρωτοκόλλου. */
export function useHandoverProtocolCheck(expectedProtocolId: string | null) {
  const [state, setState] = React.useState<HandoverProtocolCheckState>({ phase: 'idle' });
  const { begin } = useLatestRun();

  const check = React.useCallback(async (file: File) => {
    const live = begin();
    const fileName = file.name;
    setState({ phase: 'reading', fileName });
    const local = await readProtocolLocally(file);
    if (!live()) return;
    if (local.kind === 'refused') return setState({ phase: 'refused', fileName, reason: local.reason });
    if (local.kind === 'inconsistent') return setState({ phase: 'inconsistent', fileName, manifest: local.manifest });
    setState({ phase: 'asking', fileName, manifest: local.manifest });
    const outcome = await askProtocolRegistry(local.manifest.protocol.id, local.pdfSha256);
    if (!live()) return;
    if (outcome.kind === 'unavailable') return setState({ phase: 'unavailable', fileName, reason: outcome.reason });
    setState({ phase: 'judged', fileName, verdict: handoverProtocolVerdictOf(local, outcome.registry, expectedProtocolId) });
  }, [begin, expectedProtocolId]);

  const reset = React.useCallback(() => {
    begin();
    setState({ phase: 'idle' });
  }, [begin]);

  return { state, check, reset } as const;
}

export type HandoverProtocolRecordState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'ready'; readonly registry: HandoverProtocolRegistryAnswer }
  | { readonly phase: 'unavailable'; readonly reason: ProtocolRegistryUnavailable };

/** **Το μητρώο για τον κωδικό του χαρτιού** — μία ερώτηση ανά κωδικό, χωρίς αρχείο. */
export function useHandoverProtocolRecord(protocolId: string): HandoverProtocolRecordState {
  const [state, setState] = React.useState<HandoverProtocolRecordState>({ phase: 'loading' });
  const { begin } = useLatestRun();

  React.useEffect(() => {
    const live = begin();
    setState({ phase: 'loading' });
    void askProtocolRegistry(protocolId, null).then((outcome) => {
      if (!live()) return;
      setState(outcome.kind === 'answer' ? { phase: 'ready', registry: outcome.registry } : { phase: 'unavailable', reason: outcome.reason });
    });
  }, [begin, protocolId]);

  return state;
}

export type HandoverPackageCheckState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'hashing'; readonly done: number; readonly total: number }
  | { readonly phase: 'checked'; readonly check: HandoverPackageCheck };

/** **Ελέγχει το πακέτο** απέναντι στον πίνακα — ένα αρχείο τη φορά (η μνήμη της συσκευής είναι το όριο). */
export function useHandoverPackageCheck(manifest: HandoverProtocolManifest) {
  const [state, setState] = React.useState<HandoverPackageCheckState>({ phase: 'idle' });
  const { begin } = useLatestRun();

  const check = React.useCallback(async (files: readonly File[]) => {
    const live = begin();
    const evidence: HandoverPackageFileEvidence[] = [];
    setState({ phase: 'hashing', done: 0, total: files.length });
    for (const file of files) {
      evidence.push(await packageFileEvidenceOf(file));
      if (!live()) return;
      setState({ phase: 'hashing', done: evidence.length, total: files.length });
    }
    setState({ phase: 'checked', check: handoverPackageCheckOf(manifest.delivery.files, evidence) });
  }, [begin, manifest]);

  return { state, check } as const;
}
