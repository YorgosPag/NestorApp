'use client';

import { RfqList } from '@/subapps/procurement/components/RfqList';
import { useRfqs } from '@/subapps/procurement/hooks/useRfqs';

export default function RfqsPage() {
  const { rfqs, loading } = useRfqs();
  return (
    <main className="container mx-auto max-w-5xl py-6">
      <RfqList rfqs={rfqs} loading={loading} />
    </main>
  );
}
