'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function AssetsPage() {
  const AccountingAssets = LazyRoutes.AccountingAssets;
  return <AccountingAssets />;
}
