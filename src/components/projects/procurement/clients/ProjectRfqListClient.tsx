'use client';

/**
 * @module components/projects/procurement/clients/ProjectRfqListClient
 * @enterprise ADR-330 §5.1 S2 — Project-scoped RFQ list wrapper
 *
 * Fetches RFQs filtered by `projectId` and renders the existing `RfqList`.
 * Detail navigation is handled inside `RfqList` itself via `procurement-urls`
 * SSoT helper (S1).
 */

import { useRouter } from 'next/navigation';
import { useRfqs } from '@/subapps/procurement/hooks/useRfqs';
import { RfqList } from '@/subapps/procurement/components/RfqList';

export interface ProjectRfqListClientProps {
  projectId: string;
}

export function ProjectRfqListClient({ projectId }: ProjectRfqListClientProps) {
  const router = useRouter();
  const { rfqs, loading } = useRfqs({ projectId });

  const handleCreate = () => {
    router.push(`/procurement/rfqs/new?projectId=${projectId}`);
  };

  return <RfqList rfqs={rfqs} loading={loading} onCreateRfq={handleCreate} />;
}
