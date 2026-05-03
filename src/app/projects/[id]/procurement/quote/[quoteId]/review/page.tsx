import { notFound } from 'next/navigation';
import { QuoteReviewClient } from '@/app/procurement/quotes/[id]/review/QuoteReviewClient';

interface ProjectScopedQuoteReviewPageProps {
  params: Promise<{ id: string; quoteId: string }>;
}

export default async function ProjectScopedQuoteReviewPage({ params }: ProjectScopedQuoteReviewPageProps) {
  const { quoteId } = await params;
  if (!quoteId || quoteId.startsWith('[')) {
    notFound();
  }
  return <QuoteReviewClient id={quoteId} />;
}
