'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function CrmPage() {
  const CrmHub = LazyRoutes.CrmHub;
  return <CrmHub />;
}
