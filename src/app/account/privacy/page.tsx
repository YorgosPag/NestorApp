'use client';

/**
 * =============================================================================
 * ACCOUNT PRIVACY PAGE - PRIVACY SETTINGS
 * =============================================================================
 *
 * Enterprise Pattern: Privacy controls management
 * Features: Data sharing preferences, visibility controls
 *
 * @module app/account/privacy
 * @enterprise ADR-024 - Account Hub Centralization
 */

import React from 'react';
import { Lock, Eye, Database, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/design-system';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function PrivacyPage() {
  const { t } = useTranslation('common');
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  return (
    <section className={layout.flexColGap4}>
      {/* Privacy Overview */}
      <Card className={borders.getElementBorder('card', 'default')}>
        <CardHeader>
          <CardTitle className={layout.flexCenterGap2}>
            <Lock className={iconSizes.md} aria-hidden="true" />
            {t('account.privacy.title')}
          </CardTitle>
          <CardDescription>
            {t('account.privacy.description')}
          </CardDescription>
        </CardHeader>

        <CardContent className={layout.flexColGap4}>
          {/* Data Visibility */}
          <article className={cn(
            layout.flexCenterBetween,
            layout.padding4,
            borders.radiusClass.md,
            colors.bg.muted
          )}>
            <header className={layout.flexCenterGap2}>
              <Eye className={cn(iconSizes.sm, colors.text.secondary)} aria-hidden="true" />
              <div>
                <p className={cn(typography.label.sm, colors.text.primary)}>
                  {t('account.privacy.visibility')}
                </p>
                <p className={cn(typography.body.sm, colors.text.muted)}>
                  {t('account.privacy.visibilityDescription')}
                </p>
              </div>
            </header>
            <Badge variant="secondary">
              {t('account.privacy.private')}
            </Badge>
          </article>

          {/* Data Storage */}
          <article className={cn(
            layout.flexCenterBetween,
            layout.padding4,
            borders.radiusClass.md,
            colors.bg.muted
          )}>
            <header className={layout.flexCenterGap2}>
              <Database className={cn(iconSizes.sm, colors.text.secondary)} aria-hidden="true" />
              <div>
                <p className={cn(typography.label.sm, colors.text.primary)}>
                  {t('account.privacy.dataStorage')}
                </p>
                <p className={cn(typography.body.sm, colors.text.muted)}>
                  {t('account.privacy.dataStorageDescription')}
                </p>
              </div>
            </header>
            <Badge variant="secondary">
              {t('account.privacy.secure')}
            </Badge>
          </article>

          {/* Security Status */}
          <article className={cn(
            layout.flexCenterBetween,
            layout.padding4,
            borders.radiusClass.md,
            colors.bg.success
          )}>
            <header className={layout.flexCenterGap2}>
              <Shield className={cn(iconSizes.sm, colors.text.success)} aria-hidden="true" />
              <div>
                <p className={cn(typography.label.sm, colors.text.success)}>
                  {t('account.privacy.securityStatus')}
                </p>
                <p className={cn(typography.body.sm, colors.text.success)}>
                  {t('account.privacy.securityStatusDescription')}
                </p>
              </div>
            </header>
            <Badge className={cn(colors.bg.successSubtle, colors.text.success)}>
              {t('account.privacy.protected')}
            </Badge>
          </article>
        </CardContent>
      </Card>

      {/* Privacy Policy Link */}
      <Card className={borders.getElementBorder('card', 'default')}>
        <CardContent className={layout.paddingTop6}>
          <p className={cn(typography.body.sm, colors.text.muted)}>
            {t('account.privacy.policyText')}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
