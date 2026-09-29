/**
 * @fileoverview **Η ΓΕΝΝΗΣΗ ΤΟΥ WORKER ΑΝΙΧΝΕΥΣΗΣ** — το μόνο σημείο με `new Worker(new URL(…, import.meta.url))` (ADR-884 Φ2στ-γ
 * Γ3γ-2α · §4.14). Χωριστό αρχείο ώστε τα test να το αντικαθιστούν χωρίς bundler.
 * @module lib/spatial-tour/space-detect/space-detect-worker-spawn
 *
 * 🔑 **`null` αντί για σφάλμα** όταν ο browser δεν έχει Worker ή `OffscreenCanvas` (χωρίς αυτό ο Worker δεν διαβάζει pixel): ο
 *   πελάτης πέφτει στο **δίχτυ** του κύριου νήματος με τον ίδιο κώδικα.
 */

import type { WorkerLike } from '@/lib/workers/worker-rpc-protocol';

export function spawnSpaceDetectWorker(): WorkerLike | null {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null;
  return new Worker(new URL('./space-detect.worker.ts', import.meta.url), { type: 'module', name: 'space-detect' });
}
