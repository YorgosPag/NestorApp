'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function SetupPage() {
  const AccountingSetup = LazyRoutes.AccountingSetup;
  return <AccountingSetup />;
}
