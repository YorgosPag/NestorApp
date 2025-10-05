// components/NotificationBell.enterprise.tsx
'use client';

import { Bell } from 'lucide-react';
import { useNotificationDrawer } from './NotificationDrawer.enterprise';
import { useNotificationCenter } from '@/stores/notificationCenter';

export function NotificationBell() {
  const open = useNotificationDrawer(s => s.open);
  const isOpen = useNotificationDrawer(s => s.isOpen);
  const unread = useNotificationCenter(s => s.unread);

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Notifications"
      aria-expanded={isOpen}
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
