import { redirect } from 'next/navigation';
import { getQuoteDetailUrl } from '@/lib/navigation/procurement-urls';

interface ProjectScopedQuotePageProps {
  params: Promise<{ id: string; quoteId: string }>;
}

export default async function ProjectScopedQuotePage({ params }: ProjectScopedQuotePageProps) {
  const { id, quoteId } = await params;
  redirect(getQuoteDetailUrl(id, quoteId, { review: true }));
}
