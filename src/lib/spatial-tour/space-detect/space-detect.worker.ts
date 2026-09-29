/**
 * @fileoverview **Ο WEB WORKER ΤΗΣ ΑΝΙΧΝΕΥΣΗΣ ΧΩΡΩΝ** (ADR-884 Φ2στ-γ Γ3γ-2α · §4.14) — λεπτό περιτύλιγμα: λήψη + αποκωδικοποίηση
 * της κάτοψης και ανίχνευση, **όλα** εκτός κύριου νήματος.
 * @related `space-detect-host.ts` (όλη η λογική — καθαρή, δοκιμασμένη χωρίς Worker) · `space-detect-worker-spawn.ts` (ο ΜΟΝΟΣ
 *   που τον γεννά) · `lib/workers/worker-rpc-host.ts` (το RPC)
 * @module lib/spatial-tour/space-detect/space-detect.worker
 *
 * ⚠️ Χωρίς React / DOM / stores: μόνο καθαρό `lib` (ίδιο δόγμα με τους Workers του dxf-viewer, ADR-639 — πρότυπο, **όχι** εισαγωγή,
 * CHECK 3.62).
 */

import { fetchImagePixels } from '@/lib/media/image-pixels';
import { serveWorkerRpc } from '@/lib/workers/worker-rpc-host';

import { createSpaceDetectHost } from './space-detect-host';

serveWorkerRpc(self, createSpaceDetectHost((url) => fetchImagePixels(url)));

// Κενή εξαγωγή: το αρχείο μένει module υπό `isolatedModules`.
export {};
