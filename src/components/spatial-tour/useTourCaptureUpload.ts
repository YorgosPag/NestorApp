'use client';

/**
 * @fileoverview **ΤΟ ΑΝΕΒΑΣΜΑ ΜΙΑΣ ΛΗΨΗΣ, ΑΠΟ ΤΗΝ ΟΘΟΝΗ** — έναρξη → bytes στο GCS → ολοκλήρωση, με ονομασμένες φάσεις.
 * @related ADR-884 Φ0.8 · §4.5 (Κ3α) · `services/spatial-tour/spatial-tour.client.ts` · `lib/storage/resumable-upload-client.ts`
 * @module components/spatial-tour/useTourCaptureUpload
 *
 * 🔑 **Φάσεις, ποτέ `boolean`**: η οθόνη λέει «ανεβαίνει 42%» · «διακοπή δικτύου — θα συνεχιστεί» · «έλεγχος
 * πανοράματος» · «ανέβηκε» · ή **ποια** άρνηση — ο φωτογράφος ξέρει πάντα τι συμβαίνει και τι να κάνει.
 * ⚠️ Η πολιτική (τύπος · μέγεθος) κρίνεται **νωρίς** με τις **ίδιες** σταθερές του διακομιστή — ώστε 60 MB να μην
 * ξεκινήσουν να ανεβαίνουν για να απορριφθούν. Η απόφαση μένει του διακομιστή.
 */

import { useCallback, useRef, useState } from 'react';

import { refusalOfDeclaredPanorama } from '@/lib/spatial-tour/panorama-policy';
import type { TourRefusalName } from '@/lib/spatial-tour/tour-refusal-vocabulary';
import { transferResumable } from '@/lib/storage/resumable-upload-client';
import {
  finalizeTourUploadFromScreen,
  startTourUploadFromScreen,
} from '@/services/spatial-tour/spatial-tour.client';
import type { TourCapture, TourSubject } from '@/types/spatial-tour';

export type TourUploadPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'uploading'; readonly percent: number; readonly interrupted: boolean }
  | { readonly kind: 'verifying' }
  | { readonly kind: 'done'; readonly capture: TourCapture; readonly replayed: boolean }
  | { readonly kind: 'refused'; readonly reason: TourRefusalName }
  | { readonly kind: 'failed' };

const IDLE: TourUploadPhase = { kind: 'idle' };

export interface TourCaptureUpload {
  readonly phase: TourUploadPhase;
  readonly busy: boolean;
  /** Η δήλωση της λήψης (πηγή · κοινό · ορόσημο · δικαιώματα) — ταξιδεύει στην ολοκλήρωση, την κρίνει ο διακομιστής. */
  upload(file: File, declaration: Record<string, unknown>): Promise<void>;
  cancel(): void;
  reset(): void;
}

export function useTourCaptureUpload(subject: TourSubject): TourCaptureUpload {
  const [phase, setPhase] = useState<TourUploadPhase>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  const upload = useCallback(async (file: File, declaration: Record<string, unknown>) => {
    const early = refusalOfDeclaredPanorama({ contentType: file.type, byteLength: file.size });
    if (early !== null) return setPhase({ kind: 'refused', reason: early });

    setPhase({ kind: 'uploading', percent: 0, interrupted: false });
    const started = await startTourUploadFromScreen(subject, { contentType: file.type, contentLength: file.size });
    if (started.kind !== 'ok') return setPhase(started.kind === 'refused' ? started : { kind: 'failed' });

    const controller = new AbortController();
    abortRef.current = controller;
    const transferred = await transferResumable({
      sessionUri: started.value.sessionUri,
      body: file,
      signal: controller.signal,
      onProgress: (fraction) => setPhase({ kind: 'uploading', percent: Math.round(fraction * 100), interrupted: false }),
      onInterrupted: () => setPhase((prev) => (prev.kind === 'uploading' ? { ...prev, interrupted: true } : prev)),
    });
    abortRef.current = null;
    if (transferred === 'aborted') return setPhase(IDLE);
    if (transferred === 'failed') return setPhase({ kind: 'failed' });

    setPhase({ kind: 'verifying' });
    const finalized = await finalizeTourUploadFromScreen(subject, { ticket: started.value.ticket, declaration });
    if (finalized.kind !== 'ok') return setPhase(finalized.kind === 'refused' ? finalized : { kind: 'failed' });
    setPhase({ kind: 'done', capture: finalized.value.capture, replayed: finalized.value.replayed });
  }, [subject]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => setPhase(IDLE), []);
  const busy = phase.kind === 'uploading' || phase.kind === 'verifying';
  return { phase, busy, upload, cancel, reset };
}
