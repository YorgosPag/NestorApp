'use client';

/**
 * @module components/projects/procurement/clients/ProjectQuoteListClient
 * @enterprise ADR-330 §5.1 S2 — Project-scoped Quote list wrapper
 *
 * Renders the existing `QuoteList` filtered by `projectId`. Detail click
 * navigates to the project-scoped review URL via `getQuoteDetailUrl` (S1).
 * Comparison panel is intentionally deferred to a later session — for S2
 * the click target is the standalone review page.
 */

import { useRouter } from 'next/navigation';
import { useQuotes } from '@/subapps/procurement/hooks/useQuotes';
import { QuoteList } from '@/subapps/procurement/components/QuoteList';
import { getQuoteDetailUrl } from '@/lib/navigation/procurement-urls';
import type { Quote } from '@/subapps/procurement/types/quote';

export interface ProjectQuoteListClientProps {
  projectId: string;
}

export function ProjectQuoteListClient({ projectId }: ProjectQuoteListClientProps) {
  const router = useRouter();
  const { quotes, loading } = useQuotes({ projectId });

  const handleSelectQuote = (quote: Quote) => {
    router.push(getQuoteDetailUrl(projectId, quote.id, { review: true }));
  };

  const handleCreate = () => {
    router.push(`/procurement/quotes/scan?projectId=${projectId}`);
  };

  return (
    <QuoteList
      quotes={quotes}
      loading={loading}
      onSelectQuote={handleSelectQuote}
      onCreateNew={handleCreate}
    />
  );
}
