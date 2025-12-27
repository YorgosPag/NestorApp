// components/NotificationDrawer.tsx
'use client';

import { create } from 'zustand';
import { useEffect, useRef, useState } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useNotificationStore } from '@/stores/notificationStore';
import { fetchNotifications, connectSampleWS } from '@/api/notificationApi';
import { useTranslation } from '@/i18n';
import { HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

type DrawerState = { isOpen: boolean; open: () => void; close: () => void; };

export const useNotificationDrawer = create<DrawerState>(set => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false })
}));

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
};

const colorMap = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500'
};

export function NotificationDrawer() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { isOpen, close } = useNotificationDrawer();
  const { items, markRead } = useNotificationStore();
  const { t, i18n } = useTranslation('common');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ ENTERPRISE: Intl.DateTimeFormat για σταθερή μορφοποίηση με user locale
  const dateFormatter = new Intl.DateTimeFormat(i18n.language || 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // ✅ ENTERPRISE: Focus management - trap and restore
  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element (the Bell button)
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus first interactive element (close button)
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    // Restore focus when drawer closes
    return () => {
      previousActiveElement.current?.focus();
    };
  }, [isOpen]);

  // ✅ ENTERPRISE: Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  // ✅ ENTERPRISE: Fetch notifications + WebSocket with error handling
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        const data = await fetchNotifications();
        data.forEach(x => useNotificationStore.getState().add(x));
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load notifications');
      } finally {
        setIsLoading(false);
      }
    })();
    const disconnect = connectSampleWS(n => useNotificationStore.getState().add(n));
    return disconnect;
  }, []);

  const handleRetry = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const data = await fetchNotifications();
      data.forEach(x => useNotificationStore.getState().add(x));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={close}
      />

      {/* Drawer - ✅ ENTERPRISE: aria-modal for accessibility */}
      <aside
        id="notification-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-title"
        className={`fixed right-0 top-0 h-screen w-[420px] ${colors.bg.primary} shadow-xl flex flex-col z-[9999] border-l`}
      >
        {/* ✅ ENTERPRISE: Live region for screen readers */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {t('notifications.count', { count: items.length, defaultValue: `${items.length} notifications` })}
        </div>

        <header className="flex items-center justify-between p-4 border-b">
          <h2 id="notif-title" className="text-lg font-semibold">{t('notifications.title', { defaultValue: 'Notifications' })}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                markRead();
              }}
              className={`text-sm px-3 py-1.5 rounded-md ${HOVER_BACKGROUND_EFFECTS.ACCENT} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
            >
              {t('notifications.markAllRead', { defaultValue: 'Mark all read' })}
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              className={`p-1.5 rounded-md ${HOVER_BACKGROUND_EFFECTS.ACCENT} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
              aria-label={t('buttons.close', { defaultValue: 'Close' })}
            >
              <X className={iconSizes.md} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* ✅ ENTERPRISE: Error state UI */}
          {loadError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-4">
              <AlertCircle className={`${iconSizes.xl} text-red-500`} />
              <p className="text-sm text-center">{t('notifications.error', { defaultValue: 'Failed to load' })}</p>
              <button
                type="button"
                onClick={handleRetry}
                className={`px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
              >
                {t('notifications.retry', { defaultValue: 'Retry' })}
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>{t('notifications.loading', { defaultValue: 'Loading...' })}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>{t('notifications.empty', { defaultValue: 'No notifications' })}</p>
            </div>
          ) : (
            items.map(n => {
              const Icon = iconMap[n.kind];
              const colorClass = colorMap[n.kind];

              return (
                <article
                  key={n.id}
                  className={`border-b p-4 ${HOVER_BACKGROUND_EFFECTS.ACCENT_SUBTLE} ${TRANSITION_PRESETS.STANDARD_COLORS} ${!n.read ? 'bg-accent/20' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`${iconSizes.md} mt-0.5 flex-shrink-0 ${colorClass}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm mb-1">{n.title}</div>
                      {n.body && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                          {n.body}
                        </p>
                      )}
                      <time className="text-xs text-muted-foreground mt-2 block">
                        {dateFormatter.format(new Date(n.createdAt))}
                      </time>
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => markRead([n.id])}
                        className={`text-xs px-2 py-1 rounded-md flex-shrink-0 ${HOVER_BACKGROUND_EFFECTS.ACCENT} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                      >
                        {t('notifications.markRead', { defaultValue: 'Mark read' })}
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
