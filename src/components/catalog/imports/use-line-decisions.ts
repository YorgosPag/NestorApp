'use client';

/**
 * @fileoverview **Η κατάσταση κάθε γραμμής χωρίς πεδίο** στην οθόνη (ADR-923 §5.5.2 Β3 Γ8): «ξαναερμηνεύεται…» όσο ταξιδεύει η
 *   απόφαση, «άρνηση με λόγο» όταν ο διακομιστής δεν μπόρεσε χωρίς νέα ανάγνωση. Η ίδια η απόφαση ζει στην παρτίδα (`lineOverrides`)·
 *   εδώ μόνο ό,τι δεν είναι ακόμη αλήθεια του διακομιστή.
 * @module components/catalog/imports/use-line-decisions
 */

import { useCallback, useState } from 'react';

import { lineKeyOf } from '@/subapps/catalog/import/page-line-overrides';
import type { ImportLineOutcome, ImportProposalWire, SetImportLineRequest } from '@/subapps/catalog/types/catalog-import-requests';
import type { ImportLineRefusal } from '@/subapps/catalog/vocabulary/catalog-import';

export type LineActivity = { readonly kind: 'saving' } | { readonly kind: 'refused'; readonly reason: ImportLineRefusal };

type SendLine = (proposal: ImportProposalWire, request: SetImportLineRequest) => Promise<ImportLineOutcome | null>;

const withEntry = (map: ReadonlyMap<string, LineActivity>, key: string, entry: LineActivity | null): ReadonlyMap<string, LineActivity> => {
  const next = new Map(map);
  if (entry === null) next.delete(key); else next.set(key, entry);
  return next;
};

export function useLineDecisions(send: SendLine) {
  const [activity, setActivity] = useState<ReadonlyMap<string, LineActivity>>(() => new Map());
  const decideLine = useCallback(async (proposal: ImportProposalWire, request: SetImportLineRequest) => {
    const key = lineKeyOf(request);
    setActivity((current) => withEntry(current, key, { kind: 'saving' }));
    const outcome = await send(proposal, request);
    setActivity((current) => withEntry(current, key, outcome?.kind === 'refused' ? { kind: 'refused', reason: outcome.reason } : null));
  }, [send]);
  return { lineActivity: activity, decideLine };
}
