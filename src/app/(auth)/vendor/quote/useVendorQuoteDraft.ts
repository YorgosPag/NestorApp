'use client';

/**
 * Η κατάσταση της προσφοράς υπό σύνταξη + οι πράξεις της (ADR-327 §8.5). Η λογική ζει στο καθαρό
 * `vendor-quote-draft`· εδώ μόνο το React state.
 *
 * @module app/(auth)/vendor/quote/useVendorQuoteDraft
 */

import { useCallback, useMemo, useState } from 'react';
import type { PublicRfqLine } from '@/subapps/procurement/types/rfq-line';
import type { AdditionalLineDraft, AlternateDraft, RfqAnswerDraft, VendorQuoteDraft } from './types';
import { draftTotals, newAdditionalLine, newAlternate } from './vendor-quote-draft';

export interface VendorQuoteDraftActions {
  updateAnswer: (rfqLineId: string, patch: Partial<RfqAnswerDraft>) => void;
  addAlternate: (rfqLine: PublicRfqLine) => void;
  updateAlternate: (key: string, patch: Partial<AlternateDraft>) => void;
  removeAlternate: (key: string) => void;
  addAdditional: () => void;
  updateAdditional: (key: string, patch: Partial<AdditionalLineDraft>) => void;
  removeAdditional: (key: string) => void;
}

function patchWhere<T>(items: T[], match: (item: T) => boolean, patch: Partial<T>): T[] {
  return items.map((item) => (match(item) ? { ...item, ...patch } : item));
}

export function useVendorQuoteDraft(initial: VendorQuoteDraft) {
  const [draft, setDraft] = useState<VendorQuoteDraft>(initial);

  const updateAnswer = useCallback((rfqLineId: string, patch: Partial<RfqAnswerDraft>) => {
    setDraft((d) => ({ ...d, answers: patchWhere(d.answers, (a) => a.rfqLineId === rfqLineId, patch) }));
  }, []);
  const addAlternate = useCallback((rfqLine: PublicRfqLine) => {
    setDraft((d) => ({ ...d, alternates: [...d.alternates, newAlternate(rfqLine)] }));
  }, []);
  const updateAlternate = useCallback((key: string, patch: Partial<AlternateDraft>) => {
    setDraft((d) => ({ ...d, alternates: patchWhere(d.alternates, (a) => a.key === key, patch) }));
  }, []);
  const removeAlternate = useCallback((key: string) => {
    setDraft((d) => ({ ...d, alternates: d.alternates.filter((a) => a.key !== key) }));
  }, []);
  const addAdditional = useCallback(() => {
    setDraft((d) => ({ ...d, additional: [...d.additional, newAdditionalLine()] }));
  }, []);
  const updateAdditional = useCallback((key: string, patch: Partial<AdditionalLineDraft>) => {
    setDraft((d) => ({ ...d, additional: patchWhere(d.additional, (l) => l.key === key, patch) }));
  }, []);
  const removeAdditional = useCallback((key: string) => {
    setDraft((d) => ({ ...d, additional: d.additional.filter((l) => l.key !== key) }));
  }, []);

  const actions: VendorQuoteDraftActions = useMemo(() => ({
    updateAnswer, addAlternate, updateAlternate, removeAlternate, addAdditional, updateAdditional, removeAdditional,
  }), [updateAnswer, addAlternate, updateAlternate, removeAlternate, addAdditional, updateAdditional, removeAdditional]);

  const totals = useMemo(() => draftTotals(draft), [draft]);
  return { draft, actions, totals };
}
