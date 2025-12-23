// components/NotificationDrawer.enterprise.tsx
// ✅ FULL ENTERPRISE: Uses new notificationCenter store with Map-based dedup

'use client';

import { create } from 'zustand';
import { useEffect, useRef, useState } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { useNotificationCenter } from '@/stores/notificationCenter';
import { useTranslation } from '@/i18n';
import type { Notification, Severity, UserPreferences } from '@/types/notification';
import { NotificationClient } from '@/api/notificationClient';
import { HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';

type DrawerState = { isOpen: boolean; open: () => void; close: () => void; };

export const useNotificationDrawer = create<DrawerState>(set => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false })
}));

const iconMap: Record<Severity, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  critical: AlertCircle
};

const colorMap: Record<Severity, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
  critical: 'text-red-700'
};

export function NotificationDrawer() {
  const { isOpen, close } = useNotificationDrawer();
  const { items, order, markRead, status, error: storeError, ingest, setStatus, setError, cursor, setCursor } = useNotificationCenter();
  const { t, i18n } = useTranslation('common');
  const iconSizes = useIconSizes();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // ✅ SSR-safe: Lazy initialization of NotificationClient
  const clientRef = useRef<NotificationClient | null>(null);
  if (!clientRef.current && typeof window !== 'undefined') {
    clientRef.current = new NotificationClient({ baseUrl: '/api/notifications' });
  }

  // ✅ ENTERPRISE: Load user preferences για timezone
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

  useEffect(() => {
    // Fetch user preferences on mount
    const loadPreferences = async () => {
      try {
        const resp = await fetch('/api/notifications/preferences');
        if (resp.ok) {
          const prefs = await resp.json();
          setUserPreferences(prefs);
        }
      } catch (error) {
        console.error('Failed to load user preferences:', error);
      }
    };

    loadPreferences();
  }, []);

  // ✅ ENTERPRISE: Retry handler
  const handleRetry = async () => {
    if (!clientRef.current) return; // SSR-safe
    try {
      setStatus('loading');
      setError(undefined);
      const { items: newItems } = await clientRef.current.list({ limit: 50 });
      ingest(newItems as Notification[]);
      setStatus('ready');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load notifications');
      setStatus('error');
    }
  };

  // ✅ ENTERPRISE: Load More με cursor pagination
  const handleLoadMore = async () => {
    if (!clientRef.current || !cursor) return; // SSR-safe
    try {
      const { items: newItems, cursor: nextCursor } = await clientRef.current.list({ cursor, limit: 50 });
      ingest(newItems as Notification[]);
      setCursor(nextCursor);
    } catch (error) {
      console.error('Load more failed:', error);
    }
  };

  // ✅ ENTERPRISE: Notification action handler (CTAs)
  const handleAction = async (notificationId: string, actionId: string, url?: string) => {
    if (!clientRef.current) return; // SSR-safe
    try {
      // If action has a deep link, open it
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }

      // Call server to acknowledge action
      await clientRef.current.act({ id: notificationId, actionId });

      // Mark notification as acted (update local state)
      const notification = items.get(notificationId);
      if (notification) {
        const updated = { ...notification, delivery: { ...notification.delivery, state: 'acted' as const } };
        ingest([updated]);
      }
    } catch (error) {
      console.error('Action failed:', error);
    }
  };

  // ✅ ENTERPRISE: Intl.DateTimeFormat με user locale + timezone από preferences
  const dateFormatter = new Intl.DateTimeFormat(
    userPreferences?.locale || i18n.language || 'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userPreferences?.timezone || undefined // User's timezone preference
    }
  );

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

  // ✅ ENTERPRISE: Escape key + Focus trap (Tab loop)
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }

      // Focus trap: Tab loop inside drawer
      if (e.key === 'Tab') {
        const drawer = document.getElementById('notification-drawer');
        if (!drawer) return;

        const focusableElements = drawer.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: από πρώτο -> τελευταίο
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab: από τελευταίο -> πρώτο
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  // Convert Map to array για rendering
  const notificationsList: Notification[] = order.map(id => items.get(id)!).filter(Boolean);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[99998]"
        onClick={close}
      />

      {/* Drawer - ✅ ENTERPRISE: aria-modal for accessibility */}
      <aside
        id="notification-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-title"
        className="fixed right-0 top-0 h-screen w-[420px] bg-background shadow-xl flex flex-col z-[99999] border-l"
      >
        {/* ✅ ENTERPRISE: Live region for screen readers */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {t('notifications.count', { count: notificationsList.length, defaultValue: `${notificationsList.length} notifications` })}
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
          {/* ✅ ENTERPRISE: Error state UI με Retry */}
          {storeError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-4">
              <AlertCircle className={`${iconSizes.xl} text-red-500`} />
              <p className="text-sm text-center">{storeError}</p>
              <button
                type="button"
                onClick={handleRetry}
                className={`flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
              >
                <RefreshCw className={iconSizes.sm} />
                {t('notifications.retry', { defaultValue: 'Retry' })}
              </button>
            </div>
          ) : status === 'loading' ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>{t('notifications.loading', { defaultValue: 'Loading...' })}</p>
            </div>
          ) : notificationsList.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>{t('notifications.empty', { defaultValue: 'No notifications' })}</p>
            </div>
          ) : (
            notificationsList.map(n => {
              const Icon = iconMap[n.severity];
              const colorClass = colorMap[n.severity];

              return (
                <article
                  key={n.id}
                  className={`border-b p-4 ${HOVER_BACKGROUND_EFFECTS.ACCENT_SUBTLE} ${TRANSITION_PRESETS.STANDARD_COLORS} ${n.delivery.state !== 'seen' ? 'bg-accent/20' : ''}`}
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

                      {/* ✅ ENTERPRISE: Notification Actions (CTAs) */}
                      {n.actions && n.actions.length > 0 && (
                        <div className="flex items-center gap-2 mt-3">
                          {n.actions.map(action => (
                            <button
                              key={action.id}
                              type="button"
                              onClick={() => handleAction(n.id, action.id, action.url)}
                              className={`text-xs px-3 py-1.5 rounded-md font-medium ${TRANSITION_PRESETS.STANDARD_COLORS} ${
                                action.destructive
                                  ? `bg-red-600 text-white ${HOVER_BACKGROUND_EFFECTS.RED_DARKER}`
                                  : `bg-primary text-primary-foreground ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                              }`}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {n.delivery.state !== 'seen' && (
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

          {/* ✅ ENTERPRISE: Load More με cursor pagination */}
          {cursor && status === 'ready' && notificationsList.length > 0 && (
            <div className="p-4 border-t">
              <button
                type="button"
                onClick={handleLoadMore}
                className={`w-full py-2 px-4 bg-accent rounded-md text-sm font-medium ${HOVER_BACKGROUND_EFFECTS.ACCENT_DARKER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
              >
                {t('notifications.loadMore', { defaultValue: 'Load More' })}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
