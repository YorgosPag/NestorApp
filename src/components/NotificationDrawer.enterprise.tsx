// components/NotificationDrawer.enterprise.tsx
// ✅ FULL ENTERPRISE: Uses new notificationCenter store with Map-based dedup

'use client';

import { create } from 'zustand';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, RefreshCw, Eye, CheckCheck } from 'lucide-react';
import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { useNotificationCenter } from '@/stores/notificationCenter';
import { useTranslation } from '@/i18n';
import type { Notification, Severity, UserPreferences } from '@/types/notification';
import { NotificationClient } from '@/api/notificationClient';
import { markNotificationsAsRead, dismissNotification } from '@/services/notificationService';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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
  // 🔐 ENTERPRISE: Wait for auth state before making API calls
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const { isOpen, close } = useNotificationDrawer();
  const { items, order, markRead: markReadLocal, dismiss: dismissLocal, status, error: storeError, ingest, setStatus, setError, cursor, setCursor } = useNotificationCenter();

  // 🏢 ENTERPRISE: Persistent card selection (like project management cards)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 🏢 ENTERPRISE: Mark as read with Firestore persistence
  const markRead = useCallback(async (ids?: string[]) => {
    // 1. Optimistic local update
    markReadLocal(ids);

    // 2. Persist to Firestore
    const targetIds = ids ?? order.filter(id => {
      const n = items.get(id);
      return n && n.delivery.state !== 'seen';
    });

    if (targetIds.length > 0) {
      try {
        await markNotificationsAsRead(targetIds);
      } catch (error) {
        console.error('[NotificationDrawer] Failed to persist mark as read:', error);
        // Note: The real-time subscription will sync the correct state
      }
    }
  }, [markReadLocal, order, items]);

  // 🏢 ENTERPRISE: Dismiss notification (hide from panel, keep email record)
  const handleDismiss = useCallback(async (id: string) => {
    // 1. Optimistic local removal
    dismissLocal(id);

    // 2. Persist to Firestore
    try {
      await dismissNotification(id);
    } catch (error) {
      console.error('[NotificationDrawer] Failed to persist dismiss:', error);
      // Real-time subscription will sync the correct state
    }
  }, [dismissLocal]);

  const { t, i18n } = useTranslation('common');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { getStatusBorder } = useBorderTokens();
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
    // 🔐 AUTH-READY GATING - Wait for authentication
    if (authLoading) {
      console.log('⏳ [NotificationDrawer] Waiting for auth state...');
      return;
    }

    if (!user) {
      // User not authenticated - skip preferences loading
      return;
    }

    // Fetch user preferences on mount
    const loadPreferences = async () => {
      try {
        console.log('🔔 [NotificationDrawer] Loading user preferences...');

        // 🏢 ENTERPRISE: Use centralized API client (automatic Authorization header + unwrap)
        // apiClient.get() returns unwrapped data: { preferences: {...} }
        const data = await apiClient.get<{ preferences: UserPreferences }>('/api/notifications/preferences');

        if (!data || !data.preferences) {
          throw new Error('Invalid response format from API');
        }

        setUserPreferences(data.preferences);

        console.log('✅ [NotificationDrawer] User preferences loaded');
      } catch (error) {
        console.error('❌ [NotificationDrawer] Failed to load user preferences:', error);
      }
    };

    loadPreferences();
  }, [authLoading, user]);

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
    try {
      // Navigate to the relevant page
      if (url) {
        if (url.startsWith('/')) {
          // Internal URL: in-app navigation + close drawer
          close();
          router.push(url);
        } else {
          // External URL: open in new tab
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      }

      // Call server to acknowledge action (non-blocking)
      if (clientRef.current) {
        await clientRef.current.act({ id: notificationId, actionId });
      }

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
        className={`fixed right-0 top-0 h-screen w-[420px] ${colors.bg.primary} shadow-xl flex flex-col z-[99999] border-l`}
      >
        {/* ✅ ENTERPRISE: Live region for screen readers */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {t('notifications.count', { count: notificationsList.length, defaultValue: `${notificationsList.length} notifications` })}
        </div>

        <header className="flex items-center justify-between p-4 border-b">
          <h2 id="notif-title" className="text-lg font-semibold">{t('notifications.title', { defaultValue: 'Notifications' })}</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void markRead()}>
              {t('notifications.markAllRead', { defaultValue: 'Mark all read' })}
            </Button>
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="icon-sm"
              onClick={close}
              aria-label={t('buttons.close', { defaultValue: 'Close' })}
            >
              <X className={iconSizes.md} />
            </Button>
          </div>
        </header>

        {/* Scrollable content — plain div avoids Radix ScrollArea display:table overflow bug */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* ✅ ENTERPRISE: Error state UI με Retry */}
          {storeError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-4">
              <AlertCircle className={`${iconSizes.xl} text-red-500`} />
              <p className="text-sm text-center">{storeError}</p>
              <Button variant="default" size="sm" onClick={handleRetry}>
                <RefreshCw className={iconSizes.sm} />
                {t('notifications.retry', { defaultValue: 'Retry' })}
              </Button>
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
            <div className="p-2 space-y-2">
              {notificationsList.map(n => {
                const Icon = iconMap[n.severity];
                const colorClass = colorMap[n.severity];
                const isUnread = n.delivery.state !== 'seen' && n.delivery.state !== 'acted';

                // i18n: resolve display title with robust sender extraction
                const resolveDisplayTitle = (): string => {
                  if (n.titleKey) {
                    const params: Record<string, string> = { ...n.titleParams };
                    // Fallback chain for missing sender: titleParams → raw title regex → source email → default
                    if (!params.sender) {
                      const fromMatch = n.title?.match(/from (.+)$/i);
                      if (fromMatch) {
                        params.sender = fromMatch[1];
                      } else {
                        params.sender = t('notifications.unknownSender', { defaultValue: 'Άγνωστος' });
                      }
                    }
                    return t(n.titleKey, { ...params, defaultValue: n.title ?? '' });
                  }
                  if (n.title) {
                    const emailFromMatch = n.title.match(/^New (?:Email|message) from (.+)$/i);
                    if (emailFromMatch) {
                      return t('notifications.email.newFrom', { sender: emailFromMatch[1], defaultValue: n.title });
                    }
                  }
                  return n.title ?? '';
                };
                const displayTitle = resolveDisplayTitle();

                // Derive navigation URL: actions → source.feature → title-based detection
                const actionUrl = n.actions?.[0]?.url
                  ?? (n.source?.feature === 'ai-inbox' ? '/admin/ai-inbox' : undefined)
                  ?? (n.title?.toLowerCase().includes('message') ? '/admin/ai-inbox' : undefined);

                // Card states — matches project management ListCard styling
                const isSelected = selectedId === n.id;
                const cardStateClass = isSelected
                  ? `${getStatusBorder('info')} bg-[hsl(var(--bg-info))] shadow-sm`
                  : isUnread
                    ? `${getStatusBorder('info')} bg-card shadow-sm`
                    : 'border-border bg-card';

                return (
                  <Card
                    key={n.id}
                    onClick={() => setSelectedId(prev => prev === n.id ? null : n.id)}
                    className={[
                      'p-3 cursor-pointer relative',
                      'transition-colors duration-150 hover:bg-accent/50',
                      cardStateClass,
                    ].join(' ')}
                  >
                    {/* Header: severity icon + content + dismiss X */}
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className={`${iconSizes.md} mt-0.5 flex-shrink-0 ${colorClass}`} />

                      <div className="min-w-0 flex-1 overflow-hidden">
                        <span className={`text-sm leading-tight block truncate ${isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                          {displayTitle}
                        </span>
                        {n.body && (
                          <p className="text-sm text-muted-foreground break-words mt-1 line-clamp-3">
                            {n.body}
                          </p>
                        )}
                        <time className="text-xs text-muted-foreground mt-1.5 block">
                          {dateFormatter.format(new Date(n.createdAt))}
                        </time>
                      </div>

                      {/* Dismiss X — removes notification from panel */}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="flex-shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                        onClick={(e) => { e.stopPropagation(); void handleDismiss(n.id); }}
                        aria-label={t('notifications.dismiss', { defaultValue: 'Dismiss' })}
                        title={t('notifications.dismiss', { defaultValue: 'Dismiss' })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Action buttons */}
                    <nav className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-border/40">
                      {/* Προβολή (View) — navigates to relevant page */}
                      {actionUrl && (
                        <Button
                          variant="default"
                          size="xs"
                          onClick={(e) => { e.stopPropagation(); void handleAction(n.id, n.actions?.[0]?.id ?? 'view', actionUrl); }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t('notifications.actions.view_email', { defaultValue: 'Προβολή' })}
                        </Button>
                      )}

                      {/* Προβλήθηκε (Mark as Read) — always visible */}
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={!isUnread}
                        className="border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-400/50"
                        onClick={(e) => { e.stopPropagation(); void markRead([n.id]); }}
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        {t('notifications.markRead', { defaultValue: 'Προβλήθηκε' })}
                      </Button>
                    </nav>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ✅ ENTERPRISE: Load More με cursor pagination */}
          {cursor && status === 'ready' && notificationsList.length > 0 && (
            <div className="p-2 pt-0">
              <Button variant="secondary" size="sm" className="w-full" onClick={handleLoadMore}>
                {t('notifications.loadMore', { defaultValue: 'Load More' })}
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
