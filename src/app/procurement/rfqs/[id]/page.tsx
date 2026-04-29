import { RfqDetailClient } from './RfqDetailClient';

interface RfqDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RfqDetailPage({ params }: RfqDetailPageProps) {
  const { id } = await params;
  return <RfqDetailClient id={id} />;
}
