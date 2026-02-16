// components/NotificationBell.enterprise.tsx
'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotificationDrawer } from './NotificationDrawer.enterprise';
import { useNotificationCenter } from '@/stores/notificationCenter';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function NotificationBell() {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('common');
  const open = useNotificationDrawer(s => s.open);
  const isOpen = useNotificationDrawer(s => s.isOpen);
  const unread = useNotificationCenter(s => s.unread);

  const label = t('notifications.title', { defaultValue: 'Notifications' });

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={open}
      aria-label={label}
      aria-expanded={isOpen}
      aria-controls="notification-drawer"
      className="relative"
    >
      <Bell className={iconSizes.sm} aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute top-0 -right-0.5 bg-red-600 text-white text-xs px-1.5 rounded-full min-w-[20px] h-5 flex items-center justify-center font-medium" aria-hidden="true">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Button>
  );
}
