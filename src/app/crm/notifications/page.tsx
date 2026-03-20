// 🏢 ENTERPRISE: PageHeader + UnifiedDashboard pattern — 2026-03-14
'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellRing, CheckCheck, Filter, AlertCircle, Inbox, FlaskConical, Trash2 } from 'lucide-react';
import { useNotifications } from './useNotifications';
import { NotificationCard } from './NotificationCard';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useAuth } from '@/auth/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { collection, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PageLoadingState } from '@/core/states';
import { createModuleLogger } from '@/lib/telemetry';
import { PageHeader } from '@/core/headers';
import { PageContainer } from '@/core/containers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';

const logger = createModuleLogger('crm/notifications');

export default function CrmNotificationsPage() {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
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

  // 🧪 Create test notification (for development testing)
  const createTestNotification = useCallback(async () => {
    if (!user?.uid) return;

    setIsCreatingTest(true);
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
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
      setTestNotificationId(docRef.id);
      logger.info('Test notification created', { id: docRef.id });
    } catch (err) {
      logger.error('Failed to create test notification', { error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsCreatingTest(false);
    }
  }, [t, user?.uid]);

  // 🗑️ Delete test notification
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

  // 🔒 ADR-253: Production guard — test notifications are dev-only
  if (process.env.NODE_ENV === 'production') {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Notification testing is disabled in production.</p>
      </main>
    );
  }

  // 🏢 ENTERPRISE: Dashboard stats
  const dashboardStats: DashboardStat[] = [
    { title: t('notifications.stats.total'), value: notifications.length, icon: Bell, color: 'blue' },
    { title: t('notifications.stats.unread'), value: unreadCount, icon: BellRing, color: 'orange' },
    { title: t('notifications.stats.read'), value: notifications.length - unreadCount, icon: CheckCheck, color: 'green' },
  ];

  // 🏢 ENTERPRISE: Custom actions for PageHeader
  const customActions: React.ReactNode[] = [
    // Mark all as read button
    React.createElement(Button, {
      key: 'mark-all-read',
      onClick: () => void markAllAsRead(),
      disabled: unreadCount === 0 || loading,
      size: 'sm',
      children: [
        React.createElement(CheckCheck, { key: 'icon', className: `${iconSizes.sm} mr-2` }),
        t('notifications.markAllRead'),
      ],
    }),
    // Filter button
    React.createElement(Button, {
      key: 'filter',
      variant: 'outline' as const,
      size: 'sm',
      children: [
        React.createElement(Filter, { key: 'icon', className: `${iconSizes.sm} mr-2` }),
        t('notifications.filters'),
      ],
    }),
  ];

  // 🧪 Dev test button (development only)
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
          children: [
            React.createElement(FlaskConical, { key: 'icon', className: `${iconSizes.sm} mr-2` }),
            isCreatingTest ? t('notifications.test.creating') : t('notifications.test.create'),
          ],
        })
      );
    } else {
      customActions.push(
        React.createElement(Button, {
          key: 'dev-test-delete',
          variant: 'outline' as const,
          size: 'sm',
          onClick: () => void deleteTestNotification(),
          className: 'border-dashed text-destructive hover:text-destructive',
          children: [
            React.createElement(Trash2, { key: 'icon', className: `${iconSizes.sm} mr-2` }),
            t('notifications.test.delete'),
          ],
        })
      );
    }
  }

  return (
    <PageContainer ariaLabel={t('notifications.title')}>
      {/* 🏢 ENTERPRISE: PageHeader with breadcrumb, icon, title, dashboard toggle */}
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

      {/* 🏢 ENTERPRISE: UnifiedDashboard with stats */}
      {showDashboard && (
        <UnifiedDashboard
          stats={dashboardStats}
          columns={3}
        />
      )}

      {/* Notification content */}
      <div>
        {/* ADR-229 Phase 2: Centralized loading state */}
        {loading && (
          <PageLoadingState icon={Bell} message={t('notifications.loading')} layout="contained" />
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="flex items-center justify-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 py-8 text-destructive">
            <AlertCircle className="h-6 w-6" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Inbox className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">{t('notifications.empty')}</p>
            <p className="text-sm">{t('notifications.emptyDescription')}</p>
          </div>
        )}

        {/* Notifications List */}
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
