'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function ReportsPage() {
  const AccountingReports = LazyRoutes.AccountingReports;
  return <AccountingReports />;
}
