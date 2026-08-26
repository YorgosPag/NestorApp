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
import { Settings, Globe, Palette, Rows3 } from 'lucide-react';
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
import { useHydratedTheme } from '@/lib/appearance/useHydratedTheme';
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
import { useDensity } from '@/lib/appearance/useDensity';
import type { DensityRole } from '@/styles/design-tokens/generated/appearance';

export function PreferencesPageContent() {
  const { t, i18n } = useTranslation(COMMON_NAMESPACES);
  // 🌐 ADR-777 §8.29 — ο επιλογέας γράφει πλέον **και στη βάση**. Πριν, η επιλογή
  // ζούσε μόνο στο πρόγραμμα περιήγησης και ο διακομιστής (cron) δεν μπορούσε να τη
  // μάθει· τα αυτόματα email έφευγαν πάντα ελληνικά.
  const { setLanguage } = useLanguagePreference(COMMON_NAMESPACES);
  // 🔴 ADR-815 — ΗΤΑΝ ΑΚΡΙΒΩΣ ΤΟ ΔΕΙΓΜΑ ΠΟΥ ΤΟ README ΤΟΥ `next-themes`
  // ΣΗΜΕΙΩΝΕΙ «Do NOT use this! It will throw a hydration mismatch error»:
  // `<Select value={theme}>` με το `theme` διαβασμένο απευθείας. Δεν έσκαγε
  // **μόνο** επειδή ο `ThemeProvider` έκρυβε ΟΛΗ την εφαρμογή μέχρι το πρώτο
  // effect — δύο ελαττώματα που κρατούσαν το ένα το άλλο όρθιο.
  //
  // Πριν την ενυδάτωση το `theme` είναι `undefined` ⇒ το Radix δείχνει το
  // **placeholder** ⇒ διακομιστής και πρώτο render πελάτη συμφωνούν, και μετά
  // η τιμή διορθώνεται. Καμία απόκρυψη, καμία μετατόπιση διάταξης.
  const { theme, setTheme } = useHydratedTheme();
  // 🎚️ ADR-811 — Η ΤΡΙΤΗ ΠΡΟΤΙΜΗΣΗ. Ακολουθεί το πρότυπο ΤΟΥ ΘΕΜΑΤΟΣ (μόνο
  // πελάτης) και όχι της γλώσσας (που γράφει ΚΑΙ στη βάση): κανένας διακομιστής,
  // κανένα cron, κανένα email δεν χρειάζεται να ξέρει πόσο κενό βλέπει ο χρήστης.
  // Γράψιμο στη βάση εδώ θα ήταν κόστος χωρίς καταναλωτή — και θα ζητούσε tenant
  // scope (CHECK 3.35) για δεδομένο που δεν ανήκει σε κανέναν χώρο.
  const { density, densities, setDensity } = useDensity();

  // 🔑 ΕΞΑΝΤΛΗΤΙΚΟΣ ΧΑΡΤΗΣ, ΟΧΙ ΤΕΡΝΑΡΙΟ. Το `Record<DensityRole, string>` κάνει
  // έναν ΤΡΙΤΟ ρόλο **σφάλμα μεταγλώττισης** αντί για σιωπηλά λάθος ετικέτα.
  // Τα κλειδιά μένουν ΣΤΑΤΙΚΑ (CHECK 3.8 / ADR-744: μια δυναμική `t()` κάνει τον
  // γεννήτορα του slice να ΑΡΝΕΙΤΑΙ), αλλά η πληρότητα δεν ανατίθεται σε άνθρωπο.
  const densityLabels: Record<DensityRole, string> = {
    comfortable: t('account.preferences.densityComfortable'),
    compact: t('account.preferences.densityCompact'),
  };
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

        {/* Interface Density — ADR-811 */}
        <fieldset className={layout.flexColGap2}>
          <Label htmlFor="density" className={layout.flexCenterGap2}>
            <Rows3 className={iconSizes.xs} aria-hidden="true" />
            {t('account.preferences.density')}
          </Label>
          <Select value={density} onValueChange={(v) => setDensity(v as DensityRole)}>
            <SelectTrigger id="density" className="w-full sm:w-64">
              <SelectValue placeholder={t('account.preferences.selectDensity')} />
            </SelectTrigger>
            <SelectContent>
              {/* 🎚️ ΠΑΡΑΓΟΜΕΝΗ λίστα — οι ρόλοι ζουν στο `design-tokens.json` και
                  το `appearance.ts` είναι η προβολή τους. Χειρόγραφα
                  SelectItem εδώ θα ήταν δεύτερη λίστα που αποκλίνει σιωπηλά
                  μόλις προστεθεί τρίτος ρόλος.
                  ⚠️ Καμία τιμή δεν είναι ποτέ κενή — CHECK 3.48 (zero tolerance):
                  ένα `value=""` στο Radix Select ρίχνει ΟΛΗ την επιφάνεια. */}
              {densities.map((role) => (
                <SelectItem key={role} value={role}>
                  {densityLabels[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className={cn(typography.body.xs, colors.text.muted)}>
            {t('account.preferences.densityHint')}
          </p>
        </fieldset>
      </CardContent>
    </Card>
  );
}

export default PreferencesPageContent;
