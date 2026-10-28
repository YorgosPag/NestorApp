'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useIsMobile } from '@/hooks/useMobile';
import { useLiveSearchParams } from '@/hooks/useUrlQuery';
import { pushUrlSearchParams, replaceUrlSearchParams } from '@/lib/url-query-state';
import type { Quote } from '../types/quote';
import { PROCUREMENT_STATUS_PARAM } from '@/lib/navigation/procurement-urls';

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

/**
 * Η κατάσταση της σελίδας RFQ στη διεύθυνση (`tab` · `quote` · `pdf` · `comments`).
 *
 * 🔴 ADR-327 (2026-10-28) — ΑΛΛΑΖΕΙ ΧΩΡΙΣ ΠΛΟΗΓΗΣΗ. Ως τότε κάθε αλλαγή περνούσε από `router.push/replace` ⇒ γύρος
 * RSC της σελίδας σε ΚΑΘΕ κλικ καρτέλας (μετρημένο: 3,5 s στον dev· σε απασχολημένο server η καρτέλα «πάγωνε» — το
 * περιστατικό του handoff). Ο App Router δεν έχει shallow routing· η επίσημη διέξοδος είναι το native History API,
 * δηλαδή το SSoT `@/lib/url-query-state` (γραφή) + `useLiveSearchParams` (ανάγνωση, ζωντανή και στον dev).
 * Η σημασιολογία ιστορικού μένει ίδια: καρτέλα + «άνοιξε προσφορά» = push (§5.D.3), τα υπόλοιπα = replace.
 */
export function useRfqUrlState({
  quotes,
  quotesLoading,
}: UseRfqUrlStateOptions): UseRfqUrlStateResult {
  const searchParams = useLiveSearchParams();
  const isMobile = useIsMobile();

  const tabParam = searchParams.get('tab');
  const quoteParam = searchParams.get('quote');
  const pdfOpen = searchParams.get('pdf') === '1';
  const commentsOpen = searchParams.get('comments') === '1';

  const activeTab = useMemo<RfqTabValue>(
    () => resolveDefaultTab(quotes.length, quotesLoading, tabParam),
    [tabParam, quotes.length, quotesLoading],
  );

  const selectedQuote = useMemo<Quote | null>(() => {
    if (!quoteParam) return resolveDefaultQuote(quotes);
    const found = quotes.find((q) => q.id === quoteParam);
    return found ?? resolveDefaultQuote(quotes);
  }, [quoteParam, quotes]);

  const handleTabChange = useCallback((nextTab: RfqTabValue) => {
    pushUrlSearchParams((params) => {
      params.set('tab', nextTab);
      // ADR-330 §5.1 S3.3: το `?status=` είναι φίλτρο της λίστας ΤΗΣ καρτέλας — δεν ταξιδεύει σε άλλη λίστα.
      params.delete(PROCUREMENT_STATUS_PARAM);
    });
  }, []);

  const handleSelectQuote = useCallback(
    (quote: Quote | null) => {
      const write = (params: URLSearchParams) => {
        if (quote) params.set('quote', quote.id);
        else params.delete('quote');
      };
      // Mobile: push so back-gesture restores list (§5.E.4)
      if (isMobile) pushUrlSearchParams(write);
      else replaceUrlSearchParams(write);
    },
    [isMobile],
  );

  const handleTogglePdf = useCallback(() => {
    replaceUrlSearchParams((params) => {
      if (pdfOpen) {
        params.delete('pdf');
      } else {
        params.set('pdf', '1');
        params.delete('comments'); // mutually exclusive with comments drawer
      }
    });
  }, [pdfOpen]);

  const handleToggleComments = useCallback(() => {
    replaceUrlSearchParams((params) => {
      if (commentsOpen) {
        params.delete('comments');
      } else {
        params.set('comments', '1');
        params.delete('pdf');
      }
    });
  }, [commentsOpen]);

  // Single push: tab=quotes + quote=id — one history entry (§5.D.3)
  const handleComparisonDrillDown = useCallback((quoteId: string) => {
    pushUrlSearchParams((params) => {
      params.set('tab', 'quotes');
      params.set('quote', quoteId);
      // Άνοιγμα ΜΙΑΣ προσφοράς: φίλτρο λίστας που θα την έκρυβε φεύγει (η λίστα δείχνει την επιλογή).
      params.delete(PROCUREMENT_STATUS_PARAM);
    });
  }, []);

  // Self-correct stale ?quote= param (e.g. deleted quote in URL after refresh).
  // Fires once when loading completes. Always replace — silent, no history.
  const correctedRef = useRef(false);
  useEffect(() => {
    if (quotesLoading) { correctedRef.current = false; return; }
    if (correctedRef.current) return;
    correctedRef.current = true;
    const expectedId = selectedQuote?.id ?? null;
    if (quoteParam === expectedId) return;
    replaceUrlSearchParams((params) => {
      if (expectedId) params.set('quote', expectedId);
      else params.delete('quote');
    });
  }, [quotesLoading, selectedQuote, quoteParam]);

  return { activeTab, selectedQuote, pdfOpen, commentsOpen, handleTabChange, handleSelectQuote, handleComparisonDrillDown, handleTogglePdf, handleToggleComments };
}
