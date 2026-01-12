'use client';

/**
 * =============================================================================
 * ACCOUNT PROFILE PAGE - PERSONAL INFORMATION
 * =============================================================================
 *
 * Enterprise Pattern: User identity management
 * Features: Avatar, display name, given/family name, email (read-only)
 *
 * @module app/account/profile
 * @enterprise ADR-024 - Account Hub Centralization
 */

import React, { useState } from 'react';
import { Camera, Mail, User as UserIcon, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function ProfilePage() {
  const { user, updateUserProfile } = useAuth();
  const { t } = useTranslation('common');
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  // Form state
  const [givenName, setGivenName] = useState(user?.givenName || '');
  const [familyName, setFamilyName] = useState(user?.familyName || '');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      await updateUserProfile(givenName, familyName);
      // If we reach here without error, operation succeeded
      setMessage({ type: 'success', text: t('account.profile.saveSuccess') });
    } catch {
      setMessage({ type: 'error', text: t('account.profile.saveError') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={borders.getElementBorder('card', 'default')}>
      <CardHeader>
        <CardTitle className={layout.flexCenterGap2}>
          <UserIcon className={iconSizes.md} aria-hidden="true" />
          {t('account.profile.title')}
        </CardTitle>
        <CardDescription>
          {t('account.profile.description')}
        </CardDescription>
      </CardHeader>

      <CardContent className={layout.flexColGap4}>
        {/* Avatar Section */}
        <section className={layout.flexCenterGap4}>
          <figure className="relative">
            <Avatar className="h-20 w-20">
              {user?.photoURL ? (
                <AvatarImage
                  src={user.photoURL}
                  alt={user.displayName || t('account.defaultUser')}
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <AvatarFallback className={cn(colors.bg.muted, 'text-2xl')}>
                <UserIcon className={iconSizes.lg} />
              </AvatarFallback>
            </Avatar>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                'absolute -bottom-1 -right-1',
                'h-8 w-8 rounded-full',
                colors.bg.primary
              )}
              aria-label={t('account.profile.changePhoto')}
              disabled
            >
              <Camera className={iconSizes.xs} />
            </Button>
          </figure>
          <div>
            <p className={cn(typography.label.sm, colors.text.primary)}>
              {user?.displayName || t('account.defaultUser')}
            </p>
            <p className={cn(typography.body.sm, colors.text.muted)}>
              {t('account.profile.photoHint')}
            </p>
          </div>
        </section>

        {/* Form Fields */}
        <form className={layout.flexColGap4} onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          {/* Given Name */}
          <fieldset className={layout.flexColGap2}>
            <Label htmlFor="givenName">{t('account.profile.givenName')}</Label>
            <Input
              id="givenName"
              value={givenName}
              onChange={(e) => setGivenName(e.target.value)}
              placeholder={t('account.profile.givenNamePlaceholder')}
            />
          </fieldset>

          {/* Family Name */}
          <fieldset className={layout.flexColGap2}>
            <Label htmlFor="familyName">{t('account.profile.familyName')}</Label>
            <Input
              id="familyName"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder={t('account.profile.familyNamePlaceholder')}
            />
          </fieldset>

          {/* Email (Read-only) */}
          <fieldset className={layout.flexColGap2}>
            <Label htmlFor="email" className={layout.flexCenterGap2}>
              <Mail className={iconSizes.xs} aria-hidden="true" />
              {t('account.profile.email')}
            </Label>
            <Input
              id="email"
              value={user?.email || ''}
              disabled
              readOnly
              className={colors.bg.muted}
            />
            <p className={cn(typography.body.xs, colors.text.muted)}>
              {t('account.profile.emailHint')}
            </p>
          </fieldset>

          {/* Role (Read-only) */}
          <fieldset className={layout.flexColGap2}>
            <Label htmlFor="role" className={layout.flexCenterGap2}>
              <Building2 className={iconSizes.xs} aria-hidden="true" />
              {t('account.profile.role')}
            </Label>
            <Input
              id="role"
              value={t('account.profile.roleUser')}
              disabled
              readOnly
              className={colors.bg.muted}
            />
          </fieldset>

          {/* Message */}
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

          {/* Save Button */}
          <footer className={layout.flexCenterBetween}>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? t('account.profile.saving') : t('account.profile.save')}
            </Button>
          </footer>
        </form>
      </CardContent>
    </Card>
  );
}
