'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function NewInvoicePage() {
  const AccountingNewInvoice = LazyRoutes.AccountingNewInvoice;
  return <AccountingNewInvoice />;
}
