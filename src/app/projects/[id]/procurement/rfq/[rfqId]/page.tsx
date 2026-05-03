import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { RfqDetailClient } from '@/app/procurement/rfqs/[id]/RfqDetailClient';

interface ProjectScopedRfqDetailPageProps {
  params: Promise<{ id: string; rfqId: string }>;
}

export default async function ProjectScopedRfqDetailPage({ params }: ProjectScopedRfqDetailPageProps) {
  const { rfqId } = await params;
  if (!rfqId || rfqId.startsWith('[')) {
    notFound();
  }
  return (
    <Suspense>
      <RfqDetailClient id={rfqId} />
    </Suspense>
  );
}
