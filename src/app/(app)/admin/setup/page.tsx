'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function AdminSetupPage() {
  const Setup = LazyRoutes.AdminSetup;
  return <Setup />;
}
