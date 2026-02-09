'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function BankPage() {
  const AccountingBank = LazyRoutes.AccountingBank;
  return <AccountingBank />;
}
