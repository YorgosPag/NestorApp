'use client';

/**
 * =============================================================================
 * CRM NOTIFICATIONS PAGE CONTENT - NOTIFICATION MANAGEMENT
 * =============================================================================
 *
 * Enterprise Pattern: PageHeader + UnifiedDashboard
 * Features: Notification listing, mark-read, test notifications (dev only)
 *
 * ADR-253: μόνο το εργαλείο δοκιμών είναι development. Η σελίδα είναι προϊόν και
 * ανοίγει στην παραγωγή· φραγή σε επίπεδο σελίδας την έκρυβε από όλους.
 *
 * @module components/crm/pages/CrmNotificationsPageContent
 * @performance ADR-294 Batch 4 — lazy-loaded via LazyRoutes
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellRing, CheckCheck, AlertCircle, FlaskConical, RefreshCw } from 'lucide-react';
import { NotificationInbox } from '@/components/crm/notifications/NotificationInbox';
import { useNotificationActions } from '@/components/notifications/useNotificationActions';
import { useFirestoreNotifications } from '@/hooks/useFirestoreNotifications';
import { useNotificationCenter } from '@/stores/notificationCenter';
import { restartNotificationFeed } from '@/stores/notification-feed';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PageLoadingState } from '@/core/states';
import { createModuleLogger } from '@/lib/telemetry';
import { PageHeader } from '@/core/headers';
import { PageContainer, PageScrollBody } from '@/core/containers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import '@/lib/design-system';

const logger = createModuleLogger('crm/notifications');

export function CrmNotificationsPageContent() {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const { user, loading: authLoading } = useAuth();
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  // 🔑 ADR-927 — η σελίδα ΔΑΝΕΙΖΕΤΑΙ τη μία ροή (ίδια με το κουδούνι) και διαβάζει το ίδιο store.
  useFirestoreNotifications({ userId: user?.uid ?? '', enabled: Boolean(user?.uid) });
  const total = useNotificationCenter((s) => s.order.length);
  const unreadCount = useNotificationCenter((s) => s.unread);
  const status = useNotificationCenter((s) => s.status);
  const error = useNotificationCenter((s) => s.error);
  const { markRead } = useNotificationActions();
  // ADR-927 §13: όσο λύνεται η αυθεντικοποίηση το `user` είναι `null` ⇒ το παλιό `idle && user` έβγαινε `false` και
  // η σελίδα αναβόσβηνε «Καμία ειδοποίηση» πριν φτάσουν οι πρώτες (μετρημένο στην παραγωγή 2026-11-03).
  const loading = authLoading || status === 'loading' || (status === 'idle' && Boolean(user?.uid));

  const createTestNotification = useCallback(async () => {
    if (!user?.uid) return;

    setIsCreatingTest(true);
    try {
      const res = await fetch('/api/notifications/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json() as { success: boolean; message?: string };
      if (data.success) {
        logger.info('Test notifications created via API');
      } else {
        logger.error('Seed API failed', { response: data });
      }
    } catch (err) {
      logger.error('Failed to create test notification', { error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsCreatingTest(false);
    }
  }, [user?.uid]);

  const dashboardStats: DashboardStat[] = [
    { title: t('notifications.stats.total'), value: total, icon: Bell, color: 'blue' },
    { title: t('notifications.stats.unread'), value: unreadCount, icon: BellRing, color: 'orange' },
    { title: t('notifications.stats.read'), value: total - unreadCount, icon: CheckCheck, color: 'green' },
  ];

  const customActions: React.ReactNode[] = [
    React.createElement(Button, {
      key: 'mark-all-read',
      onClick: () => void markRead(),
      disabled: unreadCount === 0 || loading,
      size: 'sm',
    },
      React.createElement(CheckCheck, { key: 'icon', className: `${iconSizes.sm} mr-2` }),
      t('notifications.markAllRead'),
    ),
  ];

  if (process.env.NODE_ENV === 'development') {
    customActions.push(
      React.createElement(Button, {
        key: 'dev-test-create',
        variant: 'outline' as const,
        size: 'sm',
        onClick: () => void createTestNotification(),
        disabled: isCreatingTest || !user,
        className: 'border-dashed',
      },
        React.createElement(FlaskConical, { key: 'icon', className: `${iconSizes.sm} mr-2` }),
        isCreatingTest ? t('notifications.test.creating') : t('notifications.test.create'),
      )
    );
  }

  return (
    <PageContainer ariaLabel={t('notifications.title')}>
      <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        breadcrumb={<ModuleBreadcrumb />}
        title={{
          icon: Bell,
          title: t('notifications.title'),
          subtitle: t('notifications.description'),
        }}
        actions={{
          showDashboard,
          onDashboardToggle: () => setShowDashboard(!showDashboard),
          customActions,
        }}
      />

      {/* ADR-927 §11: το ΜΟΝΟ σώμα που κυλά — χωρίς αυτό η λίστα κοβόταν στην πρώτη οθόνη. */}
      <PageScrollBody>
      {showDashboard && (
        <UnifiedDashboard
          stats={dashboardStats}
          columns={3}
        />
      )}

      {loading && total === 0 ? (
        <PageLoadingState icon={Bell} message={t('notifications.loading')} layout="contained" />
      ) : error ? (
        <section role="alert" className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 py-8 text-destructive">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
          <p>{t('notifications.errors.loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={restartNotificationFeed}>
            <RefreshCw className={`${iconSizes.sm} mr-2`} aria-hidden="true" />
            {t('notifications.inbox.retry')}
          </Button>
        </section>
      ) : (
        <NotificationInbox />
      )}
      </PageScrollBody>
    </PageContainer>
  );
}

export default CrmNotificationsPageContent;
