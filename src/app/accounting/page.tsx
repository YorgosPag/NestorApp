'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';

export default function AccountingPage() {
  const AccountingDashboard = LazyRoutes.AccountingDashboard;
  return (
    <>
      <ModuleBreadcrumb className="px-6 pt-4" />
      <AccountingDashboard />
    </>
  );
}
