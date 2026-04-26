'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RfqBuilder } from '@/subapps/procurement/components/RfqBuilder';
import type { RfqBuilderInitialState } from '@/subapps/procurement/components/RfqBuilder';
import { Spinner } from '@/components/ui/spinner';

export default function NewRfqPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const boqItemsParam = searchParams.get('boqItems');

  const [initialState, setInitialState] = useState<RfqBuilderInitialState | undefined>();
  const [loading, setLoading] = useState(!!boqItemsParam);

  useEffect(() => {
    if (!boqItemsParam) return;
    const ids = boqItemsParam.split(',').filter(Boolean);
    fetch('/api/rfqs/from-boq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boqItemIds: ids }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setInitialState(json.data as RfqBuilderInitialState);
      })
      .finally(() => setLoading(false));
  }, [boqItemsParam]);

  if (loading) {
    return (
      <main className="container mx-auto max-w-3xl py-6 flex justify-center">
        <Spinner size="large" />
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl py-6">
      <RfqBuilder
        initialState={initialState}
        onSuccess={(id) => router.push(`/procurement/rfqs/${id}`)}
        onCancel={() => router.push('/procurement/rfqs')}
      />
    </main>
  );
}
