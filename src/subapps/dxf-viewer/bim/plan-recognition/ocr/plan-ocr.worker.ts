/**
 * **Ο Web Worker του OCR κάτοψης** (ADR-929 Φ0.4) — λεπτό περιτύλιγμα: η λογική ζει στο καθαρό `plan-ocr-host.ts` και ο
 * εκτελεστής ONNX στο `ocr-onnx-runtime.ts`.
 *
 * ⚠️ Χωρίς React / DOM / stores: μόνο καθαρός κώδικας (ίδιο δόγμα με τους Workers του ADR-639 και του ADR-884).
 * @module subapps/dxf-viewer/bim/plan-recognition/ocr/plan-ocr.worker
 */

import { serveWorkerRpc } from '@/lib/workers/worker-rpc-host';
import { loadOcrModels } from './ocr-onnx-runtime';
import { createPlanOcrHost } from './plan-ocr-host';

serveWorkerRpc(self, createPlanOcrHost(loadOcrModels));

// Κενή εξαγωγή: το αρχείο μένει module υπό `isolatedModules`.
export {};
