'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function CompanySettingsPage() {
  const CompanySettings = LazyRoutes.CompanySettings;
  return <CompanySettings />;
}
