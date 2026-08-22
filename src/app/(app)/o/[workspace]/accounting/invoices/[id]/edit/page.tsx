'use client';

import { use } from 'react';
import { LazyRoutes } from '@/utils/lazyRoutes';

interface EditInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id } = use(params);
  const AccountingEditInvoice = LazyRoutes.AccountingEditInvoice;
  return <AccountingEditInvoice invoiceId={id} />;
}
