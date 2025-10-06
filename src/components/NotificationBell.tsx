// components/NotificationBell.tsx
'use client';

import { Bell } from 'lucide-react';
import { useNotificationDrawer } from './NotificationDrawer';
import { useNotificationStore } from '@/stores/notificationStore';

export function NotificationBell() {
  const open = useNotificationDrawer(s => s.open);
  const unread = useNotificationStore(s => s.unread);

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Notifications"
      aria-expanded={useNotificationDrawer(s => s.isOpen)}
      aria-controls="notification-drawer"
      className="relative p-2 hover:bg-accent rounded-md transition-colors"
    >
      <Bell className="w-6 h-6" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs px-1.5 rounded-full min-w-[20px] h-5 flex items-center justify-center font-medium">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
