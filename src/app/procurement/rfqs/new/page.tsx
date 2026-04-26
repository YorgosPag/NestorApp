'use client';

import { useRouter } from 'next/navigation';
import { RfqBuilder } from '@/subapps/procurement/components/RfqBuilder';

export default function NewRfqPage() {
  const router = useRouter();
  return (
    <main className="container mx-auto max-w-3xl py-6">
      <RfqBuilder
        onSuccess={(id) => router.push(`/procurement/rfqs/${id}`)}
        onCancel={() => router.push('/procurement/rfqs')}
      />
    </main>
  );
}
