'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function EnterpriseMigrationPage() {
  const Migration = LazyRoutes.AdminEnterpriseMigration;
  return <Migration />;
}
