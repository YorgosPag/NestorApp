'use client';

/**
 * =============================================================================
 * ACCOUNT PREFERENCES PAGE - UI PREFERENCES
 * =============================================================================
 *
 * Enterprise Pattern: User preferences management
 * Features: Language, theme selection (using existing centralized systems)
 *
 * @module app/account/preferences
 * @enterprise ADR-024 - Account Hub Centralization
 */

import React from 'react';
import { Settings, Globe, Palette } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/design-system';
import { useTheme } from 'next-themes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SUPPORTED_LANGUAGES, type Language } from '@/i18n/lazy-config';

export default function PreferencesPage() {
  const { t, i18n, changeLanguage } = useTranslation('common');
  const { theme, setTheme } = useTheme();
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  const handleLanguageChange = async (value: string) => {
    await changeLanguage(value as Language);
  };

  return (
    <Card className={borders.getElementBorder('card', 'default')}>
      <CardHeader>
        <CardTitle className={layout.flexCenterGap2}>
          <Settings className={iconSizes.md} aria-hidden="true" />
          {t('account.preferences.title')}
        </CardTitle>
        <CardDescription>
          {t('account.preferences.description')}
        </CardDescription>
      </CardHeader>

      <CardContent className={layout.flexColGap4}>
        {/* Language Selection */}
        <fieldset className={layout.flexColGap2}>
          <Label htmlFor="language" className={layout.flexCenterGap2}>
            <Globe className={iconSizes.xs} aria-hidden="true" />
            {t('account.preferences.language')}
          </Label>
          <Select
            value={i18n.language}
            onValueChange={handleLanguageChange}
          >
            <SelectTrigger id="language" className="w-full sm:w-64">
              <SelectValue placeholder={t('account.preferences.selectLanguage')} />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.filter(lang => lang !== 'pseudo').map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang === 'el' ? t('account.preferences.languageGreek') : 'English'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className={cn(typography.body.xs, colors.text.muted)}>
            {t('account.preferences.languageHint')}
          </p>
        </fieldset>

        {/* Theme Selection */}
        <fieldset className={layout.flexColGap2}>
          <Label htmlFor="theme" className={layout.flexCenterGap2}>
            <Palette className={iconSizes.xs} aria-hidden="true" />
            {t('account.preferences.theme')}
          </Label>
          <Select
            value={theme}
            onValueChange={setTheme}
          >
            <SelectTrigger id="theme" className="w-full sm:w-64">
              <SelectValue placeholder={t('account.preferences.selectTheme')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t('account.preferences.themeLight')}</SelectItem>
              <SelectItem value="dark">{t('account.preferences.themeDark')}</SelectItem>
              <SelectItem value="system">{t('account.preferences.themeSystem')}</SelectItem>
            </SelectContent>
          </Select>
          <p className={cn(typography.body.xs, colors.text.muted)}>
            {t('account.preferences.themeHint')}
          </p>
        </fieldset>
      </CardContent>
    </Card>
  );
}
