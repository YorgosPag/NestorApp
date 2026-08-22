'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function CrmNotificationsPage() {
  const Notifications = LazyRoutes.CrmNotifications;
  return <Notifications />;
}
