'use client';

/**
 * =============================================================================
 * ACCOUNT NOTIFICATIONS PAGE CONTENT - NOTIFICATION PREFERENCES
 * =============================================================================
 *
 * Enterprise Pattern: Notification settings management
 * Features: Category toggles, email frequency, global controls
 *
 * @module components/account/pages/NotificationsPageContent
 * @enterprise ADR-024 - Account Hub Centralization
 * @enterprise ADR-025 - Notification Settings Centralization
 * @performance ADR-294 Batch 4 — lazy-loaded via LazyRoutes
 */

import React from 'react';
import { NotificationSettings } from '@/components/account/NotificationSettings';
import { useAuth } from '@/auth';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { cn } from '@/lib/design-system';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ACCOUNT_NOTIFICATIONS_PAGE');

export function NotificationsPageContent() {
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

export default NotificationsPageContent;
