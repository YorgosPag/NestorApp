import { redirect } from '@/lib/workspace/server-navigation';
import { QuoteReviewClient } from './QuoteReviewClient';

interface ReviewPageProps {
  params: Promise<{ workspace: string; id: string }>;
}

export default async function QuoteReviewPage({ params }: ReviewPageProps) {
  const { workspace, id } = await params;
  if (!id || id.startsWith('[')) {
    redirect('/procurement/quotes', workspace);
  }
  return <QuoteReviewClient id={id} />;
}
