/**
 * **Η γέννηση του Worker ευθυγράμμισης** — το μόνο σημείο με `new Worker(new URL(…, import.meta.url))` (ADR-929 Φ1). Χωριστό
 * αρχείο ώστε τα test να το αντικαθιστούν χωρίς bundler (μοτίβο του `space-detect-worker-spawn.ts`).
 *
 * 🔑 `null` αντί για σφάλμα όταν ο browser δεν έχει Worker: ο πελάτης πέφτει στο δίχτυ του κύριου νήματος με τον ίδιο κώδικα.
 *   Η ευθυγράμμιση δεν χρειάζεται `OffscreenCanvas` (δέχεται pixel, δεν αποκωδικοποιεί).
 * @module subapps/dxf-viewer/bim/plan-recognition/alignment/plan-align-worker-spawn
 */

import type { WorkerLike } from '@/lib/workers/worker-rpc-protocol';

export function spawnPlanAlignWorker(): WorkerLike | null {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./plan-align.worker.ts', import.meta.url), { type: 'module', name: 'plan-align' });
}
