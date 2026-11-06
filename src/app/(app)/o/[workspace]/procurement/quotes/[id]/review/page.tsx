import { redirect } from '@/lib/workspace/server-navigation';
import { CompanyQuoteReviewClient } from './CompanyQuoteReviewClient';

interface ReviewPageProps {
  params: Promise<{ workspace: string; id: string }>;
}

export default async function QuoteReviewPage({ params }: ReviewPageProps) {
  const { workspace, id } = await params;
  if (!id || id.startsWith('[')) {
    redirect('/procurement/quotes', workspace);
  }
  return <CompanyQuoteReviewClient id={id} />;
}
