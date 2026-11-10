/**
 * **Η γέννηση του Worker του OCR** — το μόνο σημείο με `new Worker(new URL(…, import.meta.url))` (ADR-929 Φ0.4). Χωριστό
 * αρχείο ώστε τα test να το αντικαθιστούν χωρίς bundler (μοτίβο του `plan-align-worker-spawn.ts`).
 *
 * 🔑 `null` αντί για σφάλμα όταν ο browser δεν έχει Worker: ο πελάτης απαντά `failed: worker-unavailable` (κανένα δίχτυ
 *   στον κύριο νήμα για OCR — βλ. `plan-ocr-host.ts`).
 * @module subapps/dxf-viewer/bim/plan-recognition/ocr/plan-ocr-worker-spawn
 */

import type { WorkerLike } from '@/lib/workers/worker-rpc-protocol';

export function spawnPlanOcrWorker(): WorkerLike | null {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./plan-ocr.worker.ts', import.meta.url), { type: 'module', name: 'plan-ocr' });
}
