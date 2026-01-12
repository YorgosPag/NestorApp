'use client';

/**
 * =============================================================================
 * ACCOUNT SECURITY PAGE - SECURITY SETTINGS
 * =============================================================================
 *
 * Enterprise Pattern: Security management
 * Features: Password reset via email, 2FA status, sessions (if supported)
 *
 * Note: We don't store or display "current password" - that's a security risk.
 * Instead, we use email-based password reset flow (industry standard).
 *
 * @module app/account/security
 * @enterprise ADR-024 - Account Hub Centralization
 */

import React, { useState } from 'react';
import { Shield, Key, Smartphone, AlertTriangle, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth, useAuthProviderInfo } from '@/auth';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function SecurityPage() {
  const { user, resetPassword } = useAuth();
  const { t } = useTranslation('common');
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  // 🏢 ENTERPRISE: Typed provider detection via providerData
  const { isPasswordUser, isOAuthUser, isGoogleUser } = useAuthProviderInfo();

  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleResetPassword = async () => {
    if (!user?.email) return;

    setIsResettingPassword(true);
    setMessage(null);

    try {
      await resetPassword(user.email);
      // If we reach here without error, operation succeeded
      setMessage({ type: 'success', text: t('account.security.resetEmailSent') });
    } catch {
      setMessage({ type: 'error', text: t('account.security.resetError') });
    } finally {
      setIsResettingPassword(false);
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
            /* OAuth User (Google, etc.) - Show info message */
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
            /* Email/Password User - Show reset option */
            <>
              {/* Info about password reset flow */}
              <p className={cn(typography.body.sm, colors.text.muted, layout.flexCenterGap2)}>
                <Mail className={iconSizes.xs} aria-hidden="true" />
                {user?.email}
              </p>

              {/* Status message */}
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

              {/* Reset password button */}
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
      <Card className={borders.getElementBorder('card', 'default')}>
        <CardHeader>
          <CardTitle className={layout.flexCenterGap2}>
            <Smartphone className={iconSizes.md} aria-hidden="true" />
            {t('account.security.twoFactorTitle')}
            <Badge variant="outline" className={cn(colors.text.muted)}>
              {t('account.security.comingSoon')}
            </Badge>
          </CardTitle>
          <CardDescription>
            {t('account.security.twoFactorDescription')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className={cn(typography.body.sm, colors.text.muted)}>
            {t('account.security.twoFactorNotAvailable')}
          </p>
        </CardContent>
      </Card>

      {/* Sessions Section */}
      <Card className={borders.getElementBorder('card', 'default')}>
        <CardHeader>
          <CardTitle className={layout.flexCenterGap2}>
            <Shield className={iconSizes.md} aria-hidden="true" />
            {t('account.security.sessionsTitle')}
            <Badge variant="outline" className={cn(colors.text.muted)}>
              {t('account.security.comingSoon')}
            </Badge>
          </CardTitle>
          <CardDescription>
            {t('account.security.sessionsDescription')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className={cn(typography.body.sm, colors.text.muted)}>
            {t('account.security.sessionsNotAvailable')}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
