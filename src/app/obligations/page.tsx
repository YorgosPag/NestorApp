'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function ObligationsPage() {
  const ObligationsHub = LazyRoutes.ObligationsHub;
  return <ObligationsHub />;
}
