import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { RfqDetailClient } from './RfqDetailClient';

interface RfqDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RfqDetailPage({ params }: RfqDetailPageProps) {
  const { id } = await params;
  // Guard: [id] is the Next.js route template placeholder — not a real Firestore ID.
  if (!id || id.startsWith('[')) {
    redirect('/procurement/rfqs');
  }
  return (
    <Suspense>
      <RfqDetailClient id={id} />
    </Suspense>
  );
}
