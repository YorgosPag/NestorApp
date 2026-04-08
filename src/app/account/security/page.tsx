'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function SecurityPage() {
  const Security = LazyRoutes.AccountSecurity;
  return <Security />;
}
