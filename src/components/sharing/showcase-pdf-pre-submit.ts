/**
 * @fileoverview Το `preSubmit` του `UnifiedShareDialog` για showcase με PDF — **ένας** παραγωγός.
 * @module components/sharing/showcase-pdf-pre-submit
 *
 * Πριν δημιουργηθεί ο σύνδεσμος, ο server παράγει το PDF και επιστρέφει πού το αποθήκευσε· το
 * `showcaseMeta` ταξιδεύει μαζί με το share. Το έγραφαν κατά λέξη το `BuildingDetails` και το
 * `project-details` (CHECK 3.28) — εδώ γράφεται μία φορά.
 */

import { nowISO } from '@/lib/date-local';
import type { CreateShareInput } from '@/types/sharing';

export type ShowcasePdfPreSubmit = () => Promise<Pick<CreateShareInput, 'showcaseMeta'>>;

interface ShowcasePdfResponse {
  data?: { pdfStoragePath?: string | null; pdfRegeneratedAt?: string | null };
}

/** `endpoint` = η διαδρομή `POST …/showcase/pdf` της οντότητας. */
export function createShowcasePdfPreSubmit(endpoint: string): ShowcasePdfPreSubmit {
  return async () => {
    const res = await fetch(endpoint, { method: 'POST' });
    if (!res.ok) throw new Error('PDF generation failed');
    const body = (await res.json()) as ShowcasePdfResponse;
    const pdfStoragePath = body.data?.pdfStoragePath?.trim();
    if (!pdfStoragePath) throw new Error('PDF generation returned no storage path');
    return {
      showcaseMeta: {
        pdfStoragePath,
        pdfRegeneratedAt: body.data?.pdfRegeneratedAt ?? nowISO(),
      },
    };
  };
}
