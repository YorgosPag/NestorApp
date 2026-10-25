/**
 * =============================================================================
 * ΡΥΘΜΙΣΕΙΣ ΚΑΤΑΛΟΓΟΥ ΑΝΑ ΧΩΡΟ — γλώσσες ανά κανάλι (ADR-923 §5.10 Δ6)
 * =============================================================================
 *
 * Ένα singleton ανά χώρο (`catalog_settings`). Λέει **σε ποιες γλώσσες** πρέπει να είναι
 * πλήρες κάθε κανάλι (Akeneo channel locales): π.χ. Έντυπο = ελληνικά, Βιτρίνα = ελληνικά +
 * αγγλικά. Η πληρότητα (`completeness/compute-completeness.ts`) μετρά **ανά κανάλι × γλώσσα
 * του καναλιού** και τίποτε άλλο.
 *
 * 🔑 Οι γλώσσες είναι οι **ανθρώπινες** γλώσσες της πλατφόρμας (`HumanLanguage`) — η ίδια ρίζα
 * με τις ετικέτες (`LocalizedText`), ώστε το `pseudo` να μην μπορεί ποτέ να γίνει γλώσσα περιεχομένου.
 * Ο χάρτης είναι `Record<CatalogChannel,…>` — δεμένος στη ρίζα των καναλιών (CHECK 3.73).
 *
 * @module subapps/catalog/types/catalog-settings
 */

import { DEFAULT_LANGUAGE, type HumanLanguage } from '@/i18n/languages';
import { mapCatalogChannels, type CatalogChannel } from '../vocabulary/channels';

export interface CatalogSettingsDefinition {
  /** Οι γλώσσες στις οποίες κρίνεται η πληρότητα κάθε καναλιού (≥ 1, χωρίς διπλότυπα). */
  readonly channelLocales: Readonly<Record<CatalogChannel, readonly HumanLanguage[]>>;
}

/** Ό,τι ισχύει για χώρο που δεν έχει αποθηκεύσει ρυθμίσεις: όλα στη γλώσσα της πλατφόρμας. */
export const DEFAULT_CATALOG_SETTINGS: CatalogSettingsDefinition = {
  channelLocales: mapCatalogChannels(() => [DEFAULT_LANGUAGE]),
};

/** Η ένωση όλων των γλωσσών των καναλιών — οι **μόνες** γλώσσες που δέχεται τιμή localizable. */
export function enabledCatalogLocales(settings: CatalogSettingsDefinition): ReadonlySet<HumanLanguage> {
  return new Set(Object.values(settings.channelLocales).flat());
}
