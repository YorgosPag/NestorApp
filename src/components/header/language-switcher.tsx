'use client';
/* eslint-disable custom/no-hardcoded-strings */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useLanguagePreference } from '@/i18n/hooks/useLanguagePreference';
import { type Namespace } from '@/i18n/lazy-config';
import {
  HUMAN_LANGUAGES,
  PSEUDO_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type Language,
} from '@/i18n/languages';
import { useIconSizes } from '@/hooks/useIconSizes';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

const logger = createModuleLogger('LanguageSwitcher');

// 🧪 ADR-666: το pseudo είναι εργαλείο localization testing (runtime transform του el).
// Μένει πίσω από dev gate — όπως το pseudolocalization project setting του Godot.
// Ο PreferencesPageContent το έκρυβε ήδη ρητά· εδώ διαρρέει σε production χρήστες.
const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Πώς **δείχνει** η κάθε γλώσσα.
 *
 * ⚠️ Τα ονόματα είναι **ενδώνυμα** (η γλώσσα στη γλώσσα της) και δεν μεταφράζονται —
 * ίδιος κανόνας με τα αναγνωριστικά ζωνών IANA του §8.28: ο χρήστης που ψάχνει
 * «English» δεν το βρίσκει γραμμένο «Αγγλικά» σε ελληνική οθόνη.
 */
const LANGUAGE_DISPLAY: Readonly<Record<Language, { name: string; flag: string }>> = {
  el: { name: 'Ελληνικά', flag: '🇬🇷' },
  en: { name: 'English', flag: '🇺🇸' },
  [PSEUDO_LANGUAGE]: { name: 'Pseudo (Dev)', flag: '🧪' },
};

/**
 * 🌐 ADR-777 §8.29 — **παραγόμενη** λίστα, ήταν χειρόγραφη.
 *
 * Ήταν η **τέταρτη** επανάληψη του ίδιου συνόλου (`lazy-config` · ο επιλογέας των
 * ρυθμίσεων · εδώ · και όποιος τη χρειαζόταν στον διακομιστή). Ο τύπος `Record<Language, …>`
 * κάνει τον μεταγλωττιστή να **απαιτήσει** εγγραφή για κάθε νέα γλώσσα: μια τρίτη
 * γλώσσα δεν μπορεί πια να προστεθεί και να λείπει σιωπηλά από αυτόν τον επιλογέα.
 */
const languages = (IS_DEV ? SUPPORTED_LANGUAGES : HUMAN_LANGUAGES).map((code) => ({
  code,
  ...LANGUAGE_DISPLAY[code],
}));

export function LanguageSwitcher() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { i18n, t } = useTranslation(COMMON_NAMESPACES);
  const [isChanging, setIsChanging] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(languages[0]);

  /**
   * 🌐 ADR-777 §8.29 — τα κείμενα που χρειάζεται **αυτή** η οθόνη.
   *
   * Το `admin` δεν είναι κρίσιμο namespace, οπότε χωρίς αυτό μια αλλαγή γλώσσας
   * μέσα στο `/admin` έπεφτε πίσω στα ελληνικά. Το ερώτημα «ποια κείμενα βλέπει ο
   * χρήστης τώρα;» ανήκει στον καλούντα· η **αλλαγή** ανήκει στο hook.
   */
  const pathname = usePathname();
  const namespaces = useMemo<readonly Namespace[]>(() => {
    const base = COMMON_NAMESPACES as readonly Namespace[];
    // ⚠️ **`usePathname`, ΟΧΙ `window.location`**: η προηγούμενη γραφή διάβαζε το
    // `window.location.pathname` τη στιγμή του κλικ, που ήταν σωστό αλλά αδύνατο να
    // απομνημονευτεί. Το hook είναι **αντιδραστικό** — μια πλοήγηση μέσα στην
    // εφαρμογή ξαναϋπολογίζει τη λίστα, ενώ ένα `useMemo(…, [])` πάνω στο `window`
    // θα κρατούσε την απάντηση της **πρώτης** σελίδας για πάντα.
    return pathname?.startsWith('/admin') ? [...base, 'admin' as Namespace] : base;
  }, [pathname]);

  // 🔑 §8.29: **ένας ιδιοκτήτης** για την αλλαγή γλώσσας. Εδώ ζούσε αντίγραφο της
  // ακολουθίας (preload → changeLanguage → localStorage) που **ξεχνούσε** να το πει
  // στη βάση — όπως και ο δεύτερος επιλογέας, αλλά με άλλα βήματα ο καθένας.
  const { setLanguage } = useLanguagePreference(namespaces);

  useEffect(() => {
    const lang = languages.find(lang => lang.code === i18n.language) || languages[0];
    setCurrentLanguage(lang);
  }, [i18n.language]);

  const handleLanguageChange = async (languageCode: string) => {
    if (isChanging || languageCode === i18n.language) return;

    setIsChanging(true);

    try {
      await setLanguage(languageCode as Language);
    } catch (error) {
      logger.error('Failed to change language', { error });
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          disabled={isChanging}
        >
          <Globe className={`${iconSizes.sm} ${isChanging ? 'animate-spin' : ''}`} />
          <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none">{currentLanguage.flag}</span>
          <span className="sr-only">{t('header.changeLanguage', { language: currentLanguage.name })}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onSelect={(event) => {
              event.preventDefault();
              handleLanguageChange(language.code);
            }}
            className={`flex items-center gap-2 ${
              currentLanguage.code === language.code ? 'bg-accent' : ''
            }`}
          >
            <span>{language.flag}</span>
            <span>{language.name}</span>
            {currentLanguage.code === language.code && (
              <span className={cn("ml-auto text-xs", colors.text.muted)}>✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
