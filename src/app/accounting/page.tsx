'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function AccountingPage() {
  const AccountingDashboard = LazyRoutes.AccountingDashboard;
  return <AccountingDashboard />;
}
