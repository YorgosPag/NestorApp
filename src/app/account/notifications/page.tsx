'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function NotificationsPage() {
  const Notifications = LazyRoutes.AccountNotifications;
  return <Notifications />;
}
