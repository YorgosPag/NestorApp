'use client';

/**
 * @fileoverview **Η κατάσταση κάθε γραμμής χωρίς πεδίο** στην οθόνη (ADR-923 §5.5.2 Β3 Γ8): «ξαναερμηνεύεται…» όσο ταξιδεύει η
 *   απόφαση, «άρνηση με λόγο» όταν ο διακομιστής δεν μπόρεσε χωρίς νέα ανάγνωση. Η ίδια η απόφαση ζει στην παρτίδα (`lineOverrides`)·
 *   εδώ μόνο ό,τι δεν είναι ακόμη αλήθεια του διακομιστή.
 * 🔑 §5.5.2 Β9δ: το `decideLine` επιστρέφει την απάντηση (έκβαση + όψη) — τη χρειάζεται η στοίβα αναίρεσης, που το τυλίγει. Η
 *    αναίρεση περνά από το **ίδιο** `decideLine`, άρα δείχνει την ίδια ένδειξη και την ίδια άρνηση με την αρχική πράξη.
 * @module components/catalog/imports/use-line-decisions
 */

import { useCallback, useState } from 'react';

import { lineKeyOf } from '@/subapps/catalog/import/page-line-overrides';
import type { ImportProposalWire, SetImportLineRequest, SetImportLineResult } from '@/subapps/catalog/types/catalog-import-requests';
import type { ImportLineRefusal } from '@/subapps/catalog/vocabulary/catalog-import';

export type LineActivity = { readonly kind: 'saving' } | { readonly kind: 'refused'; readonly reason: ImportLineRefusal };

/** Μία απόφαση γραμμής προς τον διακομιστή. `null` = απέτυχε η μεταφορά. */
export type SendLine = (proposal: ImportProposalWire, request: SetImportLineRequest) => Promise<SetImportLineResult | null>;

const withEntry = (map: ReadonlyMap<string, LineActivity>, key: string, entry: LineActivity | null): ReadonlyMap<string, LineActivity> => {
  const next = new Map(map);
  if (entry === null) next.delete(key); else next.set(key, entry);
  return next;
};

export function useLineDecisions(send: SendLine) {
  const [activity, setActivity] = useState<ReadonlyMap<string, LineActivity>>(() => new Map());
  const decideLine = useCallback<SendLine>(async (proposal, request) => {
    const key = lineKeyOf(request);
    setActivity((current) => withEntry(current, key, { kind: 'saving' }));
    const result = await send(proposal, request);
    const outcome = result?.outcome;
    setActivity((current) => withEntry(current, key, outcome?.kind === 'refused' ? { kind: 'refused', reason: outcome.reason } : null));
    return result;
  }, [send]);
  return { lineActivity: activity, decideLine };
}
