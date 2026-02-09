'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function DocumentsPage() {
  const AccountingDocuments = LazyRoutes.AccountingDocuments;
  return <AccountingDocuments />;
}
