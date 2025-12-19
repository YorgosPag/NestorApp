
'use client';

// ⚡ ENTERPRISE: Use LazyRoutes instead of direct import για massive bundle optimization
import { LazyRoutes } from '@/utils/lazyRoutes';

export default function NewObligationPage() {
  const ObligationsNew = LazyRoutes.ObligationsNew;
  return <ObligationsNew />;
}
