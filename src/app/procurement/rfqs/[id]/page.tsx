import { redirect } from 'next/navigation';
import { RfqDetailClient } from './RfqDetailClient';

interface RfqDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RfqDetailPage({ params }: RfqDetailPageProps) {
  const { id } = await params;
  // Guard: [id] is the Next.js route template placeholder — not a real Firestore ID.
  // Firestore document IDs never contain '[' or ']'. Redirect instead of crashing.
  if (!id || id.startsWith('[')) {
    redirect('/procurement/rfqs');
  }
  return <RfqDetailClient id={id} />;
}
