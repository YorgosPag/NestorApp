'use client';

/**
 * =============================================================================
 * ACCOUNT NOTIFICATIONS PAGE - NOTIFICATION PREFERENCES
 * =============================================================================
 *
 * Enterprise Pattern: Notification settings management
 * Features: Category toggles, email frequency, global controls
 *
 * @module app/account/notifications
 * @enterprise ADR-024 - Account Hub Centralization
 * @enterprise ADR-025 - Notification Settings Centralization
 */

import React from 'react';
import { NotificationSettings } from '@/components/account/NotificationSettings';
import { useAuth } from '@/auth';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { cn } from '@/lib/design-system';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ACCOUNT_NOTIFICATIONS_PAGE');

export default function NotificationsPage() {
  const { user } = useAuth();
  const layout = useLayoutClasses();

  if (!user?.uid) {
    return null;
  }

  return (
    <section className={cn(layout.flexColGap4)}>
      <NotificationSettings
        userId={user.uid}
        onSettingsChange={(settings) => {
          logger.info('Notification settings changed', {
            globalEnabled: settings.globalEnabled
          });
        }}
      />
    </section>
  );
}
