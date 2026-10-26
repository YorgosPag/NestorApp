/**
 * **Το πρόχειρο των ρυθμίσεων** — κανάλια × γλώσσες (ADR-923 §5.10 Δ6, §5.10.4 Β5). Καθαρό, χωρίς React.
 *
 * Δύο κλειδώματα **πριν** από την αποστολή, ώστε κανένα γνωστό 422 να μη σταλεί ποτέ:
 * - `lastLocale`: κάθε κανάλι κρατά ≥ 1 γλώσσα (ο ίδιος κανόνας με το `validateCatalogSettings`);
 * - `inUse`: γλώσσα με τιμές δεν φεύγει από την **ένωση** (ο κανόνας του διακομιστή, `localeLockedInUse`).
 *   Κλειδώνει μόνο το κελί που θα την αφαιρούσε από το **τελευταίο** κανάλι — τα υπόλοιπα μένουν ελεύθερα.
 *
 * @module components/catalog/settings/settings-model
 */

import { HUMAN_LANGUAGES, type HumanLanguage } from '@/i18n/languages';
import type { LocaleUsage } from '@/hooks/catalog/useCatalogLocaleUsage';
import type { CatalogSettingsDefinition } from '@/subapps/catalog/types/catalog-settings';
import { CATALOG_CHANNELS, type CatalogChannel } from '@/subapps/catalog/vocabulary/channels';

export type SettingsCellLock = 'lastLocale' | 'inUse' | null;

/** Εναλλαγή μίας γλώσσας σε ένα κανάλι — η σειρά των γλωσσών είναι **πάντα** του `HUMAN_LANGUAGES`. */
export function toggleChannelLocale(settings: CatalogSettingsDefinition, channel: CatalogChannel, locale: HumanLanguage): CatalogSettingsDefinition {
  const current = new Set(settings.channelLocales[channel]);
  if (current.has(locale)) current.delete(locale);
  else current.add(locale);
  return {
    channelLocales: { ...settings.channelLocales, [channel]: HUMAN_LANGUAGES.filter((language) => current.has(language)) },
  };
}

function channelsWith(settings: CatalogSettingsDefinition, locale: HumanLanguage): number {
  return CATALOG_CHANNELS.filter((channel) => settings.channelLocales[channel].includes(locale)).length;
}

/** Γιατί δεν αλλάζει αυτό το κελί — `null` ⇒ αλλάζει ελεύθερα. Μόνο η **αφαίρεση** κλειδώνει· η προσθήκη ποτέ. */
export function settingsCellLock(
  settings: CatalogSettingsDefinition,
  channel: CatalogChannel,
  locale: HumanLanguage,
  usage: ReadonlyMap<HumanLanguage, LocaleUsage> | null,
): SettingsCellLock {
  const locales = settings.channelLocales[channel];
  if (!locales.includes(locale)) return null;
  if (locales.length === 1) return 'lastLocale';
  if (usage?.get(locale) === 'used' && channelsWith(settings, locale) === 1) return 'inUse';
  return null;
}

/** Άλλαξε η **ένωση** των γλωσσών; (τότε η πληρότητα κάθε προϊόντος αλλάζει ⇒ πρόταση επανυπολογισμού) */
export function settingsChangeAffectsCompleteness(before: CatalogSettingsDefinition, after: CatalogSettingsDefinition): boolean {
  return CATALOG_CHANNELS.some((channel) => {
    const a = before.channelLocales[channel];
    const b = after.channelLocales[channel];
    return a.length !== b.length || a.some((locale, index) => b[index] !== locale);
  });
}
