'use client';

/**
 * =============================================================================
 * ACCOUNT PREFERENCES PAGE CONTENT - UI PREFERENCES
 * =============================================================================
 *
 * Enterprise Pattern: User preferences management
 * Features: Language, theme selection (using existing centralized systems)
 *
 * @module components/account/pages/PreferencesPageContent
 * @enterprise ADR-024 - Account Hub Centralization
 * @performance ADR-294 Batch 4 — lazy-loaded via LazyRoutes
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
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
import { useLanguagePreference } from '@/i18n/hooks/useLanguagePreference';
import {
  HUMAN_LANGUAGES,
  DEFAULT_LANGUAGE,
  isHumanLanguage,
  type Language,
} from '@/i18n/languages';

export function PreferencesPageContent() {
  const { t, i18n } = useTranslation(COMMON_NAMESPACES);
  // 🌐 ADR-777 §8.29 — ο επιλογέας γράφει πλέον **και στη βάση**. Πριν, η επιλογή
  // ζούσε μόνο στο πρόγραμμα περιήγησης και ο διακομιστής (cron) δεν μπορούσε να τη
  // μάθει· τα αυτόματα email έφευγαν πάντα ελληνικά.
  const { setLanguage } = useLanguagePreference(COMMON_NAMESPACES);
  const { theme, setTheme } = useTheme();
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  const handleLanguageChange = async (value: string) => {
    await setLanguage(value as Language);
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
            // ⚠️ Το `i18n.language` μπορεί να είναι `pseudo` (επιλογέας κεφαλίδας σε
            // περιβάλλον ανάπτυξης) — τιμή που **δεν** υπάρχει στη λίστα από κάτω. Το
            // Radix Select με τιμή εκτός συνόλου δείχνει **κενό πλαίσιο**, δηλαδή ο
            // χρήστης δεν βλέπει σε ποια γλώσσα βρίσκεται. Πέφτουμε στην προεπιλογή.
            value={isHumanLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE}
            onValueChange={handleLanguageChange}
          >
            <SelectTrigger id="language" className="w-full sm:w-64">
              <SelectValue placeholder={t('account.preferences.selectLanguage')} />
            </SelectTrigger>
            <SelectContent>
              {/* 🌐 §8.29: **παραγόμενη** λίστα — ήταν `SUPPORTED_LANGUAGES.filter(≠'pseudo')`,
                  δηλαδή η αφαίρεση γραμμένη εδώ. Τώρα ζει μία φορά στο `i18n/languages`
                  και τη μοιράζονται οθόνη και διακομιστής. */}
              {HUMAN_LANGUAGES.map((lang) => (
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

export default PreferencesPageContent;
