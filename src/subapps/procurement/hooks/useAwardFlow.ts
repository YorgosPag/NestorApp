'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { QuoteComparisonEntry, QuoteComparisonResult } from '../types/comparison';
import type { Quote } from '../types/quote';
import { isExpired } from '../utils/quote-expiration';

// ADR-328 §5.F «Optimistic + Undo» award flow.
// Named useAwardFlow (hook) rather than quote-award-service (plain module) because it
// manages React state and calls useTranslation — placing it in hooks/ per project convention.

interface UseAwardFlowOptions {
  comparison: QuoteComparisonResult | null;
  currentWinnerId: string | null;
  onFireAward: (winnerQuoteId: string, overrideReason: string | null) => Promise<void>;
  quotes?: Quote[];
}

export interface UseAwardFlowResult {
  optimisticWinnerId: string | null;
  pendingEntry: QuoteComparisonEntry | null;
  cheapestEntry: QuoteComparisonEntry | null;
  pendingExpiredEntry: QuoteComparisonEntry | null;
  handleAwardIntent: (entry: QuoteComparisonEntry) => void;
  handleDialogConfirm: (category: string, note: string) => Promise<void>;
  handleDialogCancel: () => void;
  handleExpiredDialogAction: (action: 'award_anyway' | 'request_renewal' | 'cancel') => void;
}

export function useAwardFlow({
  comparison,
  currentWinnerId,
  onFireAward,
  quotes,
}: UseAwardFlowOptions): UseAwardFlowResult {
  const { t } = useTranslation('quotes');
  const [optimisticWinnerId, setOptimisticWinnerId] = useState<string | null>(null);
  const [pendingEntry, setPendingEntry] = useState<QuoteComparisonEntry | null>(null);
  const [cheapestEntry, setCheapestEntry] = useState<QuoteComparisonEntry | null>(null);
  const [pendingExpiredEntry, setPendingExpiredEntry] = useState<QuoteComparisonEntry | null>(null);

  const executeAward = useCallback(
    async (entry: QuoteComparisonEntry, overrideReason: string | null) => {
      const prevId = currentWinnerId;
      setOptimisticWinnerId(entry.quoteId);

      const handleUndo = async () => {
        if (!prevId) return;
        setOptimisticWinnerId(prevId);
        try {
          await onFireAward(prevId, null);
          toast.success(t('rfqs.award.undoneToast'), { duration: 3000 });
        } catch {
          setOptimisticWinnerId(entry.quoteId);
          toast.error(t('rfqs.award.errorToast'));
        }
      };

      try {
        await onFireAward(entry.quoteId, overrideReason);
        toast.success(t('rfqs.award.successToast', { vendor: entry.vendorName }), {
          duration: 8000,
          action: prevId ? { label: t('rfqs.award.undoButton'), onClick: () => void handleUndo() } : undefined,
        });
      } catch {
        setOptimisticWinnerId(null);
        toast.error(t('rfqs.award.errorToast'), {
          action: { label: t('rfqs.award.errorRetry'), onClick: () => void executeAward(entry, overrideReason) },
        });
      }
    },
    [currentWinnerId, onFireAward, t],
  );

  const proceedWithAward = useCallback(
    (entry: QuoteComparisonEntry) => {
      const isCheapest =
        entry.flags.includes('cheapest') ||
        (comparison?.quotes ?? []).filter((e) => e.quoteId !== entry.quoteId).length === 0;
      if (isCheapest) { void executeAward(entry, null); return; }
      const cheapest = comparison?.quotes.find((e) => e.flags.includes('cheapest')) ?? null;
      setCheapestEntry(cheapest);
      setPendingEntry(entry);
    },
    [comparison, executeAward],
  );

  const handleAwardIntent = useCallback(
    (entry: QuoteComparisonEntry) => {
      const quote = quotes?.find((q) => q.id === entry.quoteId);
      if (quote && isExpired(quote)) {
        setPendingExpiredEntry(entry);
        return;
      }
      proceedWithAward(entry);
    },
    [quotes, proceedWithAward],
  );

  const handleExpiredDialogAction = useCallback(
    (action: 'award_anyway' | 'request_renewal' | 'cancel') => {
      const entry = pendingExpiredEntry;
      setPendingExpiredEntry(null);
      if (action === 'award_anyway' && entry) proceedWithAward(entry);
    },
    [pendingExpiredEntry, proceedWithAward],
  );

  const handleDialogConfirm = useCallback(
    async (category: string, note: string) => {
      if (!pendingEntry) return;
      const reason = note.trim() ? `${category}: ${note.trim()}` : category;
      setPendingEntry(null);
      setCheapestEntry(null);
      await executeAward(pendingEntry, reason);
    },
    [pendingEntry, executeAward],
  );

  const handleDialogCancel = useCallback(() => {
    setPendingEntry(null);
    setCheapestEntry(null);
  }, []);

  return {
    optimisticWinnerId,
    pendingEntry,
    cheapestEntry,
    pendingExpiredEntry,
    handleAwardIntent,
    handleDialogConfirm,
    handleDialogCancel,
    handleExpiredDialogAction,
  };
}
