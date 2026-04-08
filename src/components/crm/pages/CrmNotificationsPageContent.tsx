'use client';

/**
 * =============================================================================
 * CRM NOTIFICATIONS PAGE CONTENT - NOTIFICATION TESTING & MANAGEMENT
 * =============================================================================
 *
 * Enterprise Pattern: PageHeader + UnifiedDashboard
 * Features: Notification listing, mark-read, test notifications (dev only)
 *
 * @module components/crm/pages/CrmNotificationsPageContent
 * @performance ADR-294 Batch 4 — lazy-loaded via LazyRoutes
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellRing, CheckCheck, Filter, AlertCircle, Inbox, FlaskConical, Trash2 } from 'lucide-react';
import { useNotifications } from '@/components/crm/notifications/useNotifications';
import { NotificationCard } from '@/components/crm/notifications/NotificationCard';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useAuth } from '@/auth/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { setDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { generateNotificationId } from '@/services/enterprise-id.service';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PageLoadingState } from '@/core/states';
import { createModuleLogger } from '@/lib/telemetry';
import { PageHeader } from '@/core/headers';
import { PageContainer } from '@/core/containers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

const logger = createModuleLogger('crm/notifications');

export function CrmNotificationsPageContent() {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { user } = useAuth();
  const [testNotificationId, setTestNotificationId] = useState<string | null>(null);
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const {
    notifications,
    loading,
    error,
    unreadCount,
    markAllAsRead,
  } = useNotifications();

  const createTestNotification = useCallback(async () => {
    if (!user?.uid) return;

    setIsCreatingTest(true);
    try {
      const notifId = generateNotificationId();
      await setDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notifId), {
        userId: user.uid,
        tenantId: 'default',
        title: t('notifications.test.title'),
        body: t('notifications.test.body'),
        severity: 'info',
        channel: 'inapp',
        delivery: { state: 'delivered', attempts: 1 },
        source: { service: 'test', feature: 'lead', env: 'dev' },
        createdAt: Timestamp.now()
      });
      setTestNotificationId(notifId);
      logger.info('Test notification created', { id: notifId });
    } catch (err) {
      logger.error('Failed to create test notification', { error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsCreatingTest(false);
    }
  }, [t, user?.uid]);

  const deleteTestNotification = useCallback(async () => {
    if (!testNotificationId) return;

    try {
      await deleteDoc(doc(db, COLLECTIONS.NOTIFICATIONS, testNotificationId));
      setTestNotificationId(null);
      logger.info('Test notification deleted');
    } catch (err) {
      logger.error('Failed to delete test notification', { error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [testNotificationId]);

  // ADR-253: Production guard
  if (process.env.NODE_ENV === 'production') {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className={colors.text.muted}>Notification testing is disabled in production.</p>{/* eslint-disable-line custom/no-hardcoded-strings */}
      </main>
    );
  }

  const dashboardStats: DashboardStat[] = [
    { title: t('notifications.stats.total'), value: notifications.length, icon: Bell, color: 'blue' },
    { title: t('notifications.stats.unread'), value: unreadCount, icon: BellRing, color: 'orange' },
    { title: t('notifications.stats.read'), value: notifications.length - unreadCount, icon: CheckCheck, color: 'green' },
  ];

  const customActions: React.ReactNode[] = [
    React.createElement(Button, {
      key: 'mark-all-read',
      onClick: () => void markAllAsRead(),
      disabled: unreadCount === 0 || loading,
      size: 'sm',
    },
      React.createElement(CheckCheck, { key: 'icon', className: `${iconSizes.sm} mr-2` }),
      t('notifications.markAllRead'),
    ),
    React.createElement(Button, {
      key: 'filter',
      variant: 'outline' as const,
      size: 'sm',
    },
      React.createElement(Filter, { key: 'icon', className: `${iconSizes.sm} mr-2` }),
      t('notifications.filters'),
    ),
  ];

  if (process.env.NODE_ENV === 'development') {
    if (!testNotificationId) {
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
    } else {
      customActions.push(
        React.createElement(Button, {
          key: 'dev-test-delete',
          variant: 'outline' as const,
          size: 'sm',
          onClick: () => void deleteTestNotification(),
          className: 'border-dashed text-destructive hover:text-destructive',
        },
          React.createElement(Trash2, { key: 'icon', className: `${iconSizes.sm} mr-2` }),
          t('notifications.test.delete'),
        )
      );
    }
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

      {showDashboard && (
        <UnifiedDashboard
          stats={dashboardStats}
          columns={3}
        />
      )}

      <div>
        {loading && (
          <PageLoadingState icon={Bell} message={t('notifications.loading')} layout="contained" />
        )}

        {!loading && error && (
          <div className="flex items-center justify-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 py-8 text-destructive">
            <AlertCircle className="h-6 w-6" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && notifications.length === 0 && (
          <div className={cn("flex flex-col items-center justify-center py-12", colors.text.muted)}>
            <Inbox className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">{t('notifications.empty')}</p>
            <p className="text-sm">{t('notifications.emptyDescription')}</p>
          </div>
        )}

        {!loading && !error && notifications.length > 0 && (
          <div className="space-y-4">
            {notifications.map((n) => (
              <NotificationCard key={n.id} notification={n} />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

export default CrmNotificationsPageContent;
