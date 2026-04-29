import { redirect } from 'next/navigation';
import { QuoteReviewClient } from './QuoteReviewClient';

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuoteReviewPage({ params }: ReviewPageProps) {
  const { id } = await params;
  if (!id || id.startsWith('[')) {
    redirect('/procurement/quotes');
  }
  return <QuoteReviewClient id={id} />;
}
