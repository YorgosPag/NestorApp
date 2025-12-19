
'use client';

// ⚡ ENTERPRISE: Use LazyRoutes instead of direct import για massive bundle optimization
import { LazyRoutes } from '@/utils/lazyRoutes';

export default function EditObligationPage({ params }: { params: { id: string } }) {
  const ObligationsEdit = LazyRoutes.ObligationsEdit;
  return <ObligationsEdit params={params} />;
}

    