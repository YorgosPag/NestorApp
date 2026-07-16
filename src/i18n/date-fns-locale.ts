/**
 * =============================================================================
 * 🏢 ENTERPRISE: date-fns Locale Resolution (SSoT)
 * =============================================================================
 *
 * Ένα σημείο αποφασίζει ποιο date-fns locale αντιστοιχεί στην τρέχουσα γλώσσα.
 *
 * Πριν από αυτό το αρχείο ο κανόνας ήταν αντιγραμμένος σε 4 σημεία — και είχε
 * αποκλίνει: το `ui/calendar.tsx` έλυνε το `en` σε **enUS**, ενώ τα
 * `CalendarCreateDialog` / `CalendarSidebar` σε **enGB**. Στο CalendarCreateDialog
 * αυτό σήμαινε ότι το πλέγμα του ημερολογίου και η ετικέτα ημερομηνίας ακριβώς
 * δίπλα του τυπώνονταν με **διαφορετικό** locale, μέσα στο ίδιο popover.
 *
 * Κανονική τιμή = enUS, δηλαδή ό,τι ήδη χρησιμοποιούσε το κοινό `<Calendar>`
 * primitive που αποδίδει το ίδιο το πλέγμα.
 *
 * @file date-fns-locale.ts
 * @created 2026-07-16
 * @enterprise Single Source of Truth
 * @see ADR-584
 */

import type { Locale } from 'date-fns';
import { el, enUS } from 'date-fns/locale';

import { useTranslation } from '@/i18n/hooks/useTranslation';

const DATE_FNS_LOCALE_MAP: Record<string, Locale> = { el, en: enUS };

/** Γλώσσα i18n (`'el'` / `'en'`) → date-fns locale. Άγνωστη γλώσσα → el. */
export function resolveDateFnsLocale(language: string): Locale {
  return DATE_FNS_LOCALE_MAP[language] ?? el;
}

/** React binding του {@link resolveDateFnsLocale} για την τρέχουσα γλώσσα. */
export function useDateFnsLocale(): Locale {
  const { currentLanguage } = useTranslation();
  return resolveDateFnsLocale(currentLanguage);
}
