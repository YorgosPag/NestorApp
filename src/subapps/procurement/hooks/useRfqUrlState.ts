'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { Quote } from '../types/quote';

export type RfqTabValue = 'quotes' | 'comparison' | 'setup';

const VALID_TABS: readonly RfqTabValue[] = ['quotes', 'comparison', 'setup'];

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
  handleTabChange: (tab: RfqTabValue) => void;
  handleSelectQuote: (quote: Quote | null) => void;
}

export function useRfqUrlState({
  quotes,
  quotesLoading,
}: UseRfqUrlStateOptions): UseRfqUrlStateResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const quoteParam = searchParams.get('quote');

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
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return { activeTab, selectedQuote, handleTabChange, handleSelectQuote };
}
