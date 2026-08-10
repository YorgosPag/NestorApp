'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function BackupPage() {
  const BackupContent = LazyRoutes.AdminBackup;
  return <BackupContent />;
}
