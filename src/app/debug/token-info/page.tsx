'use client';

/**
 * ?? DEBUG PAGE - Token Info
 *
 * TEMPORARY page for debugging custom claims.
 * DELETE after verification!
 *
 * @route /debug/token-info
 */

import { useAuth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn, getSpacingClass, getStatusColor } from '@/lib/design-system';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export default function TokenInfoPage() {
  const { user, loading } = useAuth();
  const { t } = useTranslation('common');
  const spacing = useSpacingTokens();
  const borders = useBorderTokens();
  const colors = useSemanticColors();
  const pagePadding = getSpacingClass('p', 'lg');

  if (loading) {
    return (
      <div className={cn('container mx-auto', pagePadding)}>
        <Card>
          <CardHeader>
            <CardTitle>{t('debug.tokenInfo.loading')}</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={cn('container mx-auto', pagePadding)}>
        <Card>
          <CardHeader>
            <CardTitle>{t('debug.tokenInfo.notAuthenticated')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{t('debug.tokenInfo.loginPrompt')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get custom claims from user object
  const customClaims = {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    // These should be available from Firebase custom claims
    globalRole: user.globalRole,
    companyId: user.companyId,
    permissions: user.permissions,
    mfaEnrolled: user.mfaEnrolled,
  };

  const roleClass = user.globalRole === 'super_admin'
    ? getStatusColor('success', 'text')
    : getStatusColor('error', 'text');

  return (
    <div className={cn('container mx-auto', pagePadding)}>
      <Card>
        <CardHeader>
          <CardTitle>{t('debug.tokenInfo.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={spacing.spaceBetween.md}>
            <div>
              <h3 className={cn('font-semibold text-lg', spacing.margin.bottom.sm)}>
                {t('debug.tokenInfo.userObject')}
              </h3>
              <pre className={cn(
                colors.bg.secondary,
                colors.text.primary,
                spacing.padding.md,
                borders.radiusClass.lg,
                'overflow-auto max-h-96'
              )}>
                {JSON.stringify(customClaims, null, 2)}
              </pre>
            </div>

            <div className={cn('border-t', spacing.padding.top.md)}>
              <h3 className={cn('font-semibold text-lg', spacing.margin.bottom.sm)}>
                {t('debug.tokenInfo.fullUserObject')}
              </h3>
              <pre className={cn(
                colors.bg.secondary,
                colors.text.primary,
                spacing.padding.md,
                borders.radiusClass.lg,
                'overflow-auto max-h-96'
              )}>
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>

            <div className={cn('border-t', spacing.padding.top.md)}>
              <h3 className={cn('font-semibold text-lg', spacing.margin.bottom.sm)}>
                {t('debug.tokenInfo.keyInfo')}
              </h3>
              <ul className={spacing.spaceBetween.sm}>
                <li><strong>{t('debug.tokenInfo.uid')}:</strong> {user.uid}</li>
                <li><strong>{t('debug.tokenInfo.email')}:</strong> {user.email}</li>
                <li>
                  <strong>{t('debug.tokenInfo.globalRole')}:</strong>{' '}
                  <span className={cn(roleClass, 'font-bold')}>
                    {user.globalRole || t('debug.tokenInfo.missing')}
                  </span>
                </li>
                <li>
                  <strong>{t('debug.tokenInfo.companyId')}:</strong>{' '}
                  {user.companyId || t('debug.tokenInfo.missing')}
                </li>
                <li>
                  <strong>{t('debug.tokenInfo.permissionsCount')}:</strong>{' '}
                  {user.permissions?.length || 0}
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
