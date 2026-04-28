'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQuotes } from '@/subapps/procurement/hooks/useQuotes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import {
  defaultQuotesFilters,
  type QuotesFilterState,
} from '@/components/core/AdvancedFilters/configs/quotesFiltersConfig';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import { buildQuotesDashboardStats } from '@/subapps/procurement/components/quotesDashboardStats';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { Quote, QuoteStatus } from '@/subapps/procurement/types/quote';
import type { TradeCode } from '@/subapps/procurement/types/trade';

const logger = createModuleLogger('QUOTES_PAGE');

type PendingArchive = { quote: Quote; timer: ReturnType<typeof setTimeout> };

function byCreatedAtDesc(a: Quote, b: Quote): number {
  const aTs = (a.createdAt as { seconds: number } | null)?.seconds ?? 0;
  const bTs = (b.createdAt as { seconds: number } | null)?.seconds ?? 0;
  return bTs - aTs;
}

function applyQuoteFilters(quotes: Quote[], filters: QuotesFilterState): Quote[] {
  const search = filters.searchTerm.trim().toLowerCase();
  const status = filters.status[0];
  const trade = filters.trade[0];
  const source = filters.source[0];

  return quotes.filter((q) => {
    if (status && status !== SELECT_CLEAR_VALUE && q.status !== status) return false;
    if (trade && trade !== SELECT_CLEAR_VALUE && q.trade !== trade) return false;
    if (source && source !== SELECT_CLEAR_VALUE && q.source !== source) return false;
    if (search) {
      const vendorName = q.extractedData?.vendorName?.value?.toLowerCase() ?? '';
      const tradeStr = q.trade.toLowerCase();
      const num = q.displayNumber.toLowerCase();
      if (!num.includes(search) && !vendorName.includes(search) && !tradeStr.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

export function useQuotesPageState() {
  const { t, isNamespaceReady } = useTranslation('quotes');
  const router = useRouter();
  const { quotes: fetched, loading, error, refetch } = useQuotes();

  // ── Displayed list (separate so we can optimistically remove) ─────────────
  const [displayedQuotes, setDisplayedQuotes] = useState<Quote[]>([]);
  const pendingArchives = useRef(new Map<string, PendingArchive>());

  useEffect(() => {
    setDisplayedQuotes(
      fetched.filter((q) => !pendingArchives.current.has(q.id)),
    );
  }, [fetched]);

  // ── UI state ──────────────────────────────────────────────────────────────
  // Dashboard closed by default — parità con /procurement (POs) e UX preferenza Giorgio.
  const [showDashboard, setShowDashboard] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [quoteFilters, setQuoteFilters] = useState<QuotesFilterState>(defaultQuotesFilters);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  // ── Filtered data ─────────────────────────────────────────────────────────
  const filteredQuotes = useMemo(
    () => applyQuoteFilters(displayedQuotes, quoteFilters),
    [displayedQuotes, quoteFilters],
  );

  // ── Action-required quotes — pinned at top of list (parità con PO) ───────
  // Statuses requiring user decision: submitted (new vendor submission),
  // under_review (decision pending), expired (renew/archive needed).
  const actionRequired = useMemo(
    () => displayedQuotes.filter(
      (q) => q.status === 'submitted' || q.status === 'under_review' || q.status === 'expired',
    ),
    [displayedQuotes],
  );

  // ── Dashboard stats ───────────────────────────────────────────────────────
  const dashboardStats = useMemo(
    () => buildQuotesDashboardStats(displayedQuotes, t),
    [displayedQuotes, t],
  );

  // ── Card click → toggle status filter ─────────────────────────────────────
  const handleCardClick = useCallback(
    (stat: DashboardStat) => {
      const titleToStatus: Partial<Record<string, QuoteStatus>> = {
        [t('dashboard.draft')]:        'draft',
        [t('dashboard.underReview')]:  'under_review',
        [t('dashboard.accepted')]:     'accepted',
        [t('dashboard.expired')]:      'expired',
      };
      const mapped = titleToStatus[stat.title];
      if (!mapped) return;
      setQuoteFilters((prev) => ({
        ...prev,
        status: prev.status[0] === mapped ? [] : [mapped],
      }));
    },
    [t],
  );

  // ── Archive with undo (Google Gmail pattern) ──────────────────────────────
  const archiveWithUndo = useCallback((quoteId: string) => {
    const quote = displayedQuotes.find((q) => q.id === quoteId);
    if (!quote) return;

    setDisplayedQuotes((prev) => prev.filter((q) => q.id !== quoteId));
    if (selectedQuote?.id === quoteId) setSelectedQuote(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/quotes/${quoteId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`DELETE ${quoteId} → ${res.status}`);
      } catch (e) {
        logger.error('Archive failed', { quoteId, error: e });
        setDisplayedQuotes((prev) => [...prev, quote].sort(byCreatedAtDesc));
      } finally {
        pendingArchives.current.delete(quoteId);
      }
    }, 5000);

    pendingArchives.current.set(quoteId, { quote, timer });

    toast.warning(t('quotes.archivedMessage'), {
      action: {
        label: t('quotes.undo'),
        onClick: () => undoArchive(quoteId),
      },
      duration: 5000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedQuotes, selectedQuote, t]);

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

  // ── Selection (split panel) ───────────────────────────────────────────────
  const handleSelectQuote = useCallback((quote: Quote) => {
    setSelectedQuote((prev) => (prev?.id === quote.id ? null : quote));
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleViewQuote = useCallback((quoteId: string) => {
    const q = displayedQuotes.find((x) => x.id === quoteId)
      ?? archivedQuotes.find((x) => x.id === quoteId);
    if (q) {
      setSelectedQuote((prev) => (prev?.id === q.id ? null : q));
    }
  }, [displayedQuotes, archivedQuotes]);

  const handleScanNew = useCallback(() => {
    router.push('/procurement/quotes/scan');
  }, [router]);

  return {
    // Data
    displayedQuotes,
    filteredQuotes,
    actionRequired,
    loading,
    error,
    refetch,

    // Selection
    selectedQuote,
    setSelectedQuote,
    handleSelectQuote,

    // UI toggles
    showDashboard,
    setShowDashboard,
    showFilters,
    setShowFilters,

    // Filters
    quoteFilters,
    setQuoteFilters,
    handleFiltersChange: setQuoteFilters,

    // Dashboard
    dashboardStats,
    handleCardClick,

    // Archive
    archiveWithUndo,
    showArchived,
    archivedQuotes,
    loadingArchived,
    toggleArchived,
    restoreQuote,

    // Navigation
    handleViewQuote,
    handleScanNew,

    // i18n
    isNamespaceReady,
    t,
  };
}
