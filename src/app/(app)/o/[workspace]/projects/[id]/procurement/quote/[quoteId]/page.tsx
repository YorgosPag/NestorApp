import { getQuoteDetailUrl } from '@/lib/navigation/procurement-urls';
import { redirect } from '@/lib/workspace/server-navigation';

interface ProjectScopedQuotePageProps {
  params: Promise<{ workspace: string; id: string; quoteId: string }>;
}

export default async function ProjectScopedQuotePage({ params }: ProjectScopedQuotePageProps) {
  const { workspace, id, quoteId } = await params;
  redirect(getQuoteDetailUrl(id, quoteId, { review: true }), workspace);
}
