/**
 * **Ο Web Worker της ευθυγράμμισης κάτοψης** (ADR-929 Φ1, Δ6) — λεπτό περιτύλιγμα: όλη η λογική ζει στο καθαρό
 * `plan-align-host.ts`, δοκιμασμένο χωρίς Worker.
 *
 * ⚠️ Χωρίς React / DOM / stores: μόνο καθαρός κώδικας (ίδιο δόγμα με τους Workers του ADR-639 και του ADR-884).
 * @module subapps/dxf-viewer/bim/plan-recognition/alignment/plan-align.worker
 */

import { serveWorkerRpc } from '@/lib/workers/worker-rpc-host';
import { handlePlanAlign, planAlignReplyTransfer } from './plan-align-host';

serveWorkerRpc(self, handlePlanAlign, planAlignReplyTransfer);

// Κενή εξαγωγή: το αρχείο μένει module υπό `isolatedModules`.
export {};
