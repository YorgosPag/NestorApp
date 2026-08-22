'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function InvoicesPage() {
  const AccountingInvoices = LazyRoutes.AccountingInvoices;
  return <AccountingInvoices />;
}
