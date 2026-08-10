'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function JournalPage() {
  const AccountingJournal = LazyRoutes.AccountingJournal;
  return <AccountingJournal />;
}
