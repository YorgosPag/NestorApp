'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useIsMobile } from '@/hooks/useMobile';
import type { Quote } from '../types/quote';

export type RfqTabValue = 'quotes' | 'comparison' | 'setup' | 'history';

const VALID_TABS: readonly RfqTabValue[] = ['quotes', 'comparison', 'setup', 'history'];

function resolveDefaultTab(
  quotesLength: number,
  quotesLoading: boolean,
  tabParam: string | null,
): RfqTabValue {
  if (tabParam && (VALID_TABS as readonly string[]).includes(tabParam)) {
    return tabParam as RfqTabValue;
  }
  if (quotesLoading) return 'quotes';
  return quotesLength > 0 ? 'quotes' : 'setup';
}

function resolveDefaultQuote(quotes: Quote[]): Quote | null {
  if (quotes.length === 0) return null;
  const underReview = quotes
    .filter((q) => q.status === 'under_review')
    .sort((a, b) => {
      const aMs = a.submittedAt ? a.submittedAt.toMillis() : 0;
      const bMs = b.submittedAt ? b.submittedAt.toMillis() : 0;
      return aMs - bMs;
    });
  if (underReview.length > 0) return underReview[0];
  const sorted = [...quotes].sort((a, b) => {
    const aMs = a.submittedAt ? a.submittedAt.toMillis() : 0;
    const bMs = b.submittedAt ? b.submittedAt.toMillis() : 0;
    return bMs - aMs;
  });
  return sorted[0] ?? quotes[0];
}

interface UseRfqUrlStateOptions {
  quotes: Quote[];
  quotesLoading: boolean;
}

interface UseRfqUrlStateResult {
  activeTab: RfqTabValue;
  selectedQuote: Quote | null;
  pdfOpen: boolean;
  commentsOpen: boolean;
  handleTabChange: (tab: RfqTabValue) => void;
  handleSelectQuote: (quote: Quote | null) => void;
  handleComparisonDrillDown: (quoteId: string) => void;
  handleTogglePdf: () => void;
  handleToggleComments: () => void;
}

export function useRfqUrlState({
  quotes,
  quotesLoading,
}: UseRfqUrlStateOptions): UseRfqUrlStateResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const tabParam = searchParams.get('tab');
  const quoteParam = searchParams.get('quote');
  const pdfParam = searchParams.get('pdf');
  const commentsParam = searchParams.get('comments');
  const pdfOpen = pdfParam === '1';
  const commentsOpen = commentsParam === '1';

  const activeTab = useMemo<RfqTabValue>(
    () => resolveDefaultTab(quotes.length, quotesLoading, tabParam),
    [tabParam, quotes.length, quotesLoading],
  );

  const selectedQuote = useMemo<Quote | null>(() => {
    if (!quoteParam) return resolveDefaultQuote(quotes);
    const found = quotes.find((q) => q.id === quoteParam);
    return found ?? resolveDefaultQuote(quotes);
  }, [quoteParam, quotes]);

  const handleTabChange = useCallback(
    (nextTab: RfqTabValue) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', nextTab);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const handleSelectQuote = useCallback(
    (quote: Quote | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (quote) params.set('quote', quote.id);
      else params.delete('quote');
      const url = `${pathname}?${params.toString()}`;
      // Mobile: push so back-gesture restores list (§5.E.4)
      if (isMobile) router.push(url);
      else router.replace(url);
    },
    [router, pathname, searchParams, isMobile],
  );

  const handleTogglePdf = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (pdfOpen) {
      params.delete('pdf');
    } else {
      params.set('pdf', '1');
      params.delete('comments'); // mutually exclusive with comments drawer
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams, pdfOpen]);

  const handleToggleComments = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (commentsOpen) {
      params.delete('comments');
    } else {
      params.set('comments', '1');
      params.delete('pdf');
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams, commentsOpen]);

  // Single push: tab=quotes + quote=id — one history entry (§5.D.3)
  const handleComparisonDrillDown = useCallback(
    (quoteId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'quotes');
      params.set('quote', quoteId);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  // Self-correct stale ?quote= param (e.g. deleted quote in URL after refresh).
  // Fires once when loading completes. Always router.replace — silent, no history.
  const correctedRef = useRef(false);
  useEffect(() => {
    if (quotesLoading) { correctedRef.current = false; return; }
    if (correctedRef.current) return;
    correctedRef.current = true;
    const expectedId = selectedQuote?.id ?? null;
    const currentId = quoteParam;
    if (currentId === expectedId) return;
    const params = new URLSearchParams(searchParams.toString());
    if (expectedId) params.set('quote', expectedId);
    else params.delete('quote');
    router.replace(`${pathname}?${params.toString()}`);
  }, [quotesLoading, selectedQuote, quoteParam, searchParams, pathname, router]);

  return { activeTab, selectedQuote, pdfOpen, commentsOpen, handleTabChange, handleSelectQuote, handleComparisonDrillDown, handleTogglePdf, handleToggleComments };
}
