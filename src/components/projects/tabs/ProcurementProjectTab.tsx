'use client';

import { useRouter } from 'next/navigation';
import { useRfqs } from '@/subapps/procurement/hooks/useRfqs';
import { RfqList } from '@/subapps/procurement/components/RfqList';

export function ProcurementProjectTab({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { rfqs, loading } = useRfqs({ projectId });

  const handleCreate = () => {
    router.push(`/procurement/rfqs/new?projectId=${projectId}`);
  };

  return (
    <RfqList
      rfqs={rfqs}
      loading={loading}
      onCreateRfq={handleCreate}
    />
  );
}
