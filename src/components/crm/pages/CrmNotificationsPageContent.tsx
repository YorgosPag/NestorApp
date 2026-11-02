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
import { Bell, BellRing, CheckCheck, AlertCircle, Inbox, FlaskConical } from 'lucide-react';
import { useNotifications } from '@/components/crm/notifications/useNotifications';
import { CrmNotificationCard } from '@/components/crm/notifications/NotificationCard';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useAuth } from '@/auth/contexts/AuthContext';
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
              <CrmNotificationCard key={n.id} notification={n} />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

export default CrmNotificationsPageContent;
