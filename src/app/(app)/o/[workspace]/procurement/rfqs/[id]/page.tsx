import { Suspense } from 'react';
import { redirect } from '@/lib/workspace/server-navigation';
import { CompanyRfqDetailClient } from './CompanyRfqDetailClient';

interface RfqDetailPageProps {
  params: Promise<{ workspace: string; id: string }>;
}

export default async function RfqDetailPage({ params }: RfqDetailPageProps) {
  const { workspace, id } = await params;
  // Guard: [id] is the Next.js route template placeholder — not a real Firestore ID.
  if (!id || id.startsWith('[')) {
    redirect('/procurement/rfqs', workspace);
  }
  return (
    <Suspense>
      <CompanyRfqDetailClient id={id} />
    </Suspense>
  );
}
