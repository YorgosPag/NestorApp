'use client';

/**
 * =============================================================================
 * ACCOUNT SECURITY PAGE CONTENT - SECURITY SETTINGS
 * =============================================================================
 *
 * Enterprise Pattern: Security management
 * Features: Password reset via email, 2FA status, sessions, token refresh
 *
 * @module components/account/pages/SecurityPageContent
 * @enterprise ADR-024 - Account Hub Centralization
 * @performance ADR-294 Batch 4 — lazy-loaded via LazyRoutes
 */

import React, { useState } from 'react';
import { Key, AlertTriangle, Mail, RefreshCw } from 'lucide-react';
import { SessionsList } from '@/components/account/SessionsList';
import { TwoFactorEnrollment } from '@/components/account/TwoFactorEnrollment';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/design-system';
import { useAuth, useAuthProviderInfo } from '@/auth';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ACCOUNT_SECURITY_PAGE');

export function SecurityPageContent() {
  const { user, resetPassword, refreshToken } = useAuth();
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  const { isOAuthUser } = useAuthProviderInfo();

  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleResetPassword = async () => {
    if (!user?.email) return;

    setIsResettingPassword(true);
    setMessage(null);

    try {
      await resetPassword(user.email);
      setMessage({ type: 'success', text: t('account.security.resetEmailSent') });
    } catch {
      setMessage({ type: 'error', text: t('account.security.resetError') });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleRefreshToken = async () => {
    setIsRefreshingToken(true);
    setRefreshMessage(null);

    try {
      await refreshToken();
      setRefreshMessage({
        type: 'success',
        text: t('account.security.refreshSuccess')
      });

      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      logger.error('Token refresh failed', { error });
      setRefreshMessage({
        type: 'error',
        text: t('account.security.refreshError')
      });
    } finally {
      setIsRefreshingToken(false);
    }
  };

  return (
    <section className={layout.flexColGap4}>
      {/* Password Section */}
      <Card className={borders.getElementBorder('card', 'default')}>
        <CardHeader>
          <CardTitle className={layout.flexCenterGap2}>
            <Key className={iconSizes.md} aria-hidden="true" />
            {t('account.security.passwordTitle')}
          </CardTitle>
          <CardDescription>
            {t('account.security.passwordDescription')}
          </CardDescription>
        </CardHeader>

        <CardContent className={layout.flexColGap4}>
          {isOAuthUser ? (
            <figure
              className={cn(
                layout.flexCenterGap2,
                layout.padding4,
                borders.radiusClass.md,
                colors.bg.warning
              )}
            >
              <AlertTriangle className={cn(iconSizes.sm, colors.text.warning)} aria-hidden="true" />
              <figcaption className={cn(typography.body.sm, colors.text.warning)}>
                {t('account.security.googleSignIn')}
              </figcaption>
            </figure>
          ) : (
            <>
              <p className={cn(typography.body.sm, colors.text.muted, layout.flexCenterGap2)}>
                <Mail className={iconSizes.xs} aria-hidden="true" />
                {user?.email}
              </p>

              {message && (
                <output
                  role="status"
                  className={cn(
                    layout.padding3,
                    borders.radiusClass.md,
                    typography.body.sm,
                    message.type === 'success'
                      ? cn(colors.bg.success, colors.text.success)
                      : cn(colors.bg.error, colors.text.error)
                  )}
                >
                  {message.text}
                </output>
              )}

              <Button
                onClick={handleResetPassword}
                disabled={isResettingPassword || !user?.email}
                variant="outline"
              >
                {isResettingPassword
                  ? t('account.security.sendingReset')
                  : t('account.security.resetPassword')
                }
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* 2FA Section */}
      {user?.uid && (
        <TwoFactorEnrollment
          userId={user.uid}
          onStatusChange={(status) => {
            logger.info('2FA status changed', { status: status.status });
          }}
        />
      )}

      {/* Sessions Section */}
      {user?.uid && (
        <SessionsList
          userId={user.uid}
          onSessionsChange={() => {
            logger.info('Sessions updated');
          }}
        />
      )}

      {/* Token Refresh Section */}
      <Card className={borders.getElementBorder('card', 'default')}>
        <CardHeader>
          <CardTitle className={layout.flexCenterGap2}>
            <RefreshCw className={iconSizes.md} aria-hidden="true" />
            {t('account.security.refreshTitle')}
          </CardTitle>
          <CardDescription>
            {t('account.security.refreshDescription')}
          </CardDescription>
        </CardHeader>

        <CardContent className={layout.flexColGap4}>
          <p className={cn(typography.body.sm, colors.text.muted)}>
            {t('account.security.refreshBody')}
          </p>

          {refreshMessage && (
            <output
              role="status"
              className={cn(
                layout.padding3,
                borders.radiusClass.md,
                typography.body.sm,
                refreshMessage.type === 'success'
                  ? cn(colors.bg.success, colors.text.success)
                  : cn(colors.bg.error, colors.text.error)
              )}
            >
              {refreshMessage.text}
            </output>
          )}

          <Button
            onClick={handleRefreshToken}
            disabled={isRefreshingToken}
            variant="outline"
            className={layout.flexCenterGap2}
          >
            <RefreshCw
              className={cn(
                iconSizes.sm,
                isRefreshingToken && 'animate-spin'
              )}
              aria-hidden="true"
            />
            {isRefreshingToken ? t('account.security.refreshing') : t('account.security.refreshButton')}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

export default SecurityPageContent;
