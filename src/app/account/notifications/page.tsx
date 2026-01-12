'use client';

/**
 * =============================================================================
 * ACCOUNT NOTIFICATIONS PAGE - NOTIFICATION PREFERENCES
 * =============================================================================
 *
 * Enterprise Pattern: Notification settings management
 * Note: Shows "Not available yet" if no notification system exists
 *
 * @module app/account/notifications
 * @enterprise ADR-024 - Account Hub Centralization
 */

import React from 'react';
import { Bell, Construction } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function NotificationsPage() {
  const { t } = useTranslation('common');
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  return (
    <Card className={borders.getElementBorder('card', 'default')}>
      <CardHeader>
        <CardTitle className={layout.flexCenterGap2}>
          <Bell className={iconSizes.md} aria-hidden="true" />
          {t('account.notifications.title')}
        </CardTitle>
        <CardDescription>
          {t('account.notifications.description')}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Enterprise "Not Available Yet" Empty State */}
        <figure
          role="status"
          className={cn(
            layout.flexColGap4,
            layout.centerContent,
            layout.paddingY12,
            layout.textCenter
          )}
        >
          <Construction
            className={cn(iconSizes.xl, colors.text.muted)}
            aria-hidden="true"
          />
          <figcaption>
            <p className={cn(typography.label.sm, colors.text.secondary)}>
              {t('account.notifications.notAvailable')}
            </p>
            <p className={cn(typography.body.sm, layout.marginTop1, colors.text.muted)}>
              {t('account.notifications.comingSoon')}
            </p>
          </figcaption>
        </figure>
      </CardContent>
    </Card>
  );
}
