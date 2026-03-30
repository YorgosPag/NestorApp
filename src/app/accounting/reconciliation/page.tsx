'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function ReconciliationPage() {
  const AccountingReconciliation = LazyRoutes.AccountingReconciliation;
  return <AccountingReconciliation />;
}
