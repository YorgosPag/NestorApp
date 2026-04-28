'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQuotes } from '@/subapps/procurement/hooks/useQuotes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import type { Quote } from '@/subapps/procurement/types/quote';

const logger = createModuleLogger('QUOTES_PAGE');

type PendingArchive = { quote: Quote; timer: ReturnType<typeof setTimeout> };

function byCreatedAtDesc(a: Quote, b: Quote): number {
  const aTs = (a.createdAt as { seconds: number } | null)?.seconds ?? 0;
  const bTs = (b.createdAt as { seconds: number } | null)?.seconds ?? 0;
  return bTs - aTs;
}

export function useQuotesPageState() {
  const { t, isNamespaceReady } = useTranslation('quotes');
  const router = useRouter();
  const { quotes: fetched, loading, error, refetch } = useQuotes();

  // Displayed list — separate from fetched so we can optimistically remove
  const [displayedQuotes, setDisplayedQuotes] = useState<Quote[]>([]);

  // Sync fetched → displayed (only when no pending archive for that id)
  const pendingArchives = useRef(new Map<string, PendingArchive>());

  useEffect(() => {
    setDisplayedQuotes(
      fetched.filter((q) => !pendingArchives.current.has(q.id)),
    );
  }, [fetched]);

  // ── Archive with undo (Google Gmail pattern) ──────────────────────────────

  const archiveWithUndo = useCallback((quoteId: string) => {
    const quote = displayedQuotes.find((q) => q.id === quoteId);
    if (!quote) return;

    // 1. Optimistic remove
    setDisplayedQuotes((prev) => prev.filter((q) => q.id !== quoteId));

    // 2. Schedule actual DELETE after 5s
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/quotes/${quoteId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`DELETE ${quoteId} → ${res.status}`);
      } catch (e) {
        logger.error('Archive failed', { quoteId, error: e });
        // Restore on failure
        setDisplayedQuotes((prev) => [...prev, quote].sort(byCreatedAtDesc));
      } finally {
        pendingArchives.current.delete(quoteId);
      }
    }, 5000);

    pendingArchives.current.set(quoteId, { quote, timer });

    // 3. Toast with undo action
    toast.warning(t('quotes.archivedMessage'), {
      action: {
        label: t('quotes.undo'),
        onClick: () => undoArchive(quoteId),
      },
      duration: 5000,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedQuotes, t]);

  const undoArchive = useCallback((quoteId: string) => {
    const pending = pendingArchives.current.get(quoteId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingArchives.current.delete(quoteId);
    setDisplayedQuotes((prev) => [...prev, pending.quote].sort(byCreatedAtDesc));
  }, []);

  // ── Archived quotes view ──────────────────────────────────────────────────

  const [showArchived, setShowArchived] = useState(false);
  const [archivedQuotes, setArchivedQuotes] = useState<Quote[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  const fetchArchived = useCallback(async () => {
    setLoadingArchived(true);
    try {
      const res = await fetch('/api/quotes?status=archived');
      if (!res.ok) throw new Error(`Fetch archived → ${res.status}`);
      const json = await res.json() as { success: boolean; data: Quote[] };
      setArchivedQuotes(json.data ?? []);
    } catch (e) {
      logger.error('Fetch archived failed', { error: e });
      setArchivedQuotes([]);
    } finally {
      setLoadingArchived(false);
    }
  }, []);

  const toggleArchived = useCallback(async () => {
    const next = !showArchived;
    setShowArchived(next);
    if (next) await fetchArchived();
  }, [showArchived, fetchArchived]);

  const restoreQuote = useCallback(async (quoteId: string) => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      });
      if (!res.ok) throw new Error(await res.text());
      setArchivedQuotes((prev) => prev.filter((q) => q.id !== quoteId));
      toast.success(t('quotes.restoreSuccess'));
      void refetch();
    } catch (e) {
      logger.error('Restore failed', { quoteId, error: e });
    }
  }, [t, refetch]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleViewQuote = useCallback((quoteId: string) => {
    router.push(`/procurement/quotes/${quoteId}/review`);
  }, [router]);

  const handleScanNew = useCallback(() => {
    router.push('/procurement/quotes/scan');
  }, [router]);

  return {
    displayedQuotes,
    loading,
    error,
    refetch,
    archiveWithUndo,
    handleViewQuote,
    handleScanNew,
    showArchived,
    archivedQuotes,
    loadingArchived,
    toggleArchived,
    restoreQuote,
    isNamespaceReady,
    t,
  };
}
