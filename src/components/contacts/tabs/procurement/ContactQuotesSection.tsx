'use client';

import { useRouter } from 'next/navigation';
import { QuoteList } from '@/subapps/procurement/components/QuoteList';
import type { Quote } from '@/subapps/procurement/types/quote';

interface ContactQuotesSectionProps {
  quotes: Quote[];
  loading: boolean;
  archived: boolean;
  contactId: string;
}

export function ContactQuotesSection({
  quotes,
  loading,
  archived,
  contactId,
}: ContactQuotesSectionProps) {
  const router = useRouter();

  return (
    <QuoteList
      quotes={quotes}
      loading={loading}
      onSelectQuote={(q) => router.push(`/procurement/quotes/${q.id}/review`)}
      onCreateNew={
        archived
          ? undefined
          : () =>
              router.push(
                `/procurement/quotes/new?vendorContactId=${encodeURIComponent(contactId)}`
              )
      }
    />
  );
}
