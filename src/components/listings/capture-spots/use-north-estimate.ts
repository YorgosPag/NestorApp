'use client';

/**
 * @fileoverview 🧭 **Ο βορράς της κάτοψης, από τις πυξίδες των φωτογραφιών της** — κατά απαίτηση (ADR-897 Φ5.2).
 * @related lib/listings/floorplan-north (`estimateNorthFromCompass` — η αριθμητική) · use-capture-facts (η μνήμη)
 * @module components/listings/capture-spots/use-north-estimate
 *
 * 🔑 **Κατά απαίτηση, όχι στο άνοιγμα**: κάθε πυξίδα είναι μια ανάγνωση bytes στον διακομιστή. Ο άνθρωπος πατά
 *   «Εύρεση» όταν τη χρειάζεται· ό,τι έχει ήδη ζητηθεί (επιλογή φωτογραφίας) έρχεται από τη μνήμη.
 * 🔑 **Δείγματα = οι φωτογραφίες ΑΥΤΗΣ της κάτοψης με θέση στο ΠΡΟΧΕΙΡΟ** — η κατεύθυνση που μετρά είναι αυτή που
 *   βλέπει τώρα ο άνθρωπος, όχι η αποθηκευμένη.
 * ⚠️ Το αποτέλεσμα είναι δεμένο στην κάτοψη για την οποία ζητήθηκε: αλλαγή καρτέλας ⇒ ξεχνιέται (ποτέ βορράς του
 *   ισογείου προτεινόμενος για τον όροφο).
 */

import { useCallback, useRef, useState } from 'react';

import { estimateNorthFromCompass, type CompassSample, type NorthEstimate } from '@/lib/listings/floorplan-north';
import type { PhotoCaptureSpot } from '@/lib/listings/photo-capture-spot';
import type { CustodyKind } from '@/lib/workspace/custody-scope';

import { loadCaptureFacts } from './use-capture-facts';

/** Πόσα αιτήματα ταυτόχρονα — αρκετά για να τελειώσει γρήγορα, λίγα για να μη γονατίσει τον διακομιστή. */
const CONCURRENCY = 4;

export type NorthEstimateState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'done'; readonly estimate: NorthEstimate | null; readonly samples: number };

interface Keyed {
  readonly floorplanId: string;
  readonly state: NorthEstimateState;
}

const IDLE: NorthEstimateState = { status: 'idle' };

async function collectSamples(
  placed: readonly (readonly [string, PhotoCaptureSpot])[],
  custody: CustodyKind,
): Promise<CompassSample[]> {
  const samples: CompassSample[] = [];
  for (let start = 0; start < placed.length; start += CONCURRENCY) {
    const batch = placed.slice(start, start + CONCURRENCY);
    const facts = await Promise.all(batch.map(([photoId]) => loadCaptureFacts(photoId, custody)));
    facts.forEach((fact, index) => {
      const compassRad = fact?.compassRad ?? null;
      if (compassRad !== null) samples.push({ headingRad: batch[index][1].headingRad, compassRad });
    });
  }
  return samples;
}

export function useNorthEstimate(
  floorplanId: string | null,
  spots: ReadonlyMap<string, PhotoCaptureSpot>,
  custody: CustodyKind,
): { readonly state: NorthEstimateState; readonly run: () => void } {
  const [keyed, setKeyed] = useState<Keyed | null>(null);
  const latest = useRef(0);

  const run = useCallback(() => {
    if (floorplanId === null) return;
    const request = ++latest.current;
    const placed = [...spots].filter(([, spot]) => spot.floorplanFileId === floorplanId);
    setKeyed({ floorplanId, state: { status: 'loading' } });
    void collectSamples(placed, custody).then((samples) => {
      // Νεότερη ερώτηση ⇒ αυτή η απάντηση είναι μπαγιάτικη (N.7.2 #2).
      if (request !== latest.current) return;
      setKeyed({ floorplanId, state: { status: 'done', estimate: estimateNorthFromCompass(samples), samples: samples.length } });
    });
  }, [floorplanId, spots, custody]);

  const state = keyed !== null && keyed.floorplanId === floorplanId ? keyed.state : IDLE;
  return { state, run };
}
